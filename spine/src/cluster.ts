import { statSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Database } from 'bun:sqlite';
import { getQmdStore } from './search';
import { workingDir } from './working';

export interface EmbeddedDoc {
	targetKind: 'capture' | 'working' | 'local-file';
	targetId: string;
	vector: Float32Array;
}

// Read all embedded documents from the QMD database.
// For local-files, resolves the hash-based QMD path to the real file path via latticeDb.
export function readEmbeddedDocs(qmdDb: Database, latticeDb: Database): EmbeddedDoc[] {
	type QmdRow = { collection: string; path: string; embedding: Buffer };
	const rows = qmdDb
		.query<QmdRow, []>(
			`SELECT d.collection, d.path, v.embedding
			 FROM vectors_vec v
			 JOIN content_vectors cv
			   ON cv.hash || '_' || cv.seq = v.hash_seq AND cv.seq = 0
			 JOIN documents d ON d.hash = cv.hash
			 WHERE d.active = 1
			   AND d.collection IN ('captures', 'working', 'local-files')`,
		)
		.all();

	const fileStmt = latticeDb.query<{ path: string }, [string, string]>(
		`SELECT path FROM file_index WHERE machine_id = ? AND hash = ?`,
	);

	const docs: EmbeddedDoc[] = [];
	for (const row of rows) {
		const buf = row.embedding;
		const vector = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);

		if (row.collection === 'captures') {
			const id = basename(row.path, '.md');
			docs.push({ targetKind: 'capture', targetId: id, vector });
		} else if (row.collection === 'working') {
			const slug = basename(row.path, '.md');
			docs.push({ targetKind: 'working', targetId: slug, vector });
		} else if (row.collection === 'local-files') {
			const parts = row.path.split('/');
			const machineId = parts[0];
			const hash = basename(parts[1] ?? '', '.md');
			const fileRow = fileStmt.get(machineId, hash);
			if (fileRow) {
				docs.push({ targetKind: 'local-file', targetId: fileRow.path, vector });
			}
		}
	}
	return docs;
}

function cosineDistance(a: Float32Array, b: Float32Array): number {
	let dot = 0;
	let magA = 0;
	let magB = 0;
	for (let i = 0; i < a.length; i++) {
		dot += a[i] * b[i];
		magA += a[i] * a[i];
		magB += b[i] * b[i];
	}
	const denom = Math.sqrt(magA) * Math.sqrt(magB);
	return denom === 0 ? 1 : 1 - dot / denom;
}

interface KmeansCluster {
	centroid: Float32Array;
	members: number[];
}

export function kmeans(points: Float32Array[], k: number): KmeansCluster[] {
	if (points.length === 0 || k <= 0) return [];
	k = Math.min(k, points.length);

	const dim = points[0].length;

	// k-means++ seeding
	const centroids: Float32Array[] = [];
	// Pick first centroid: index 0 (deterministic for reproducibility)
	centroids.push(new Float32Array(points[0]));

	for (let c = 1; c < k; c++) {
		// Each point's probability is proportional to squared distance to nearest centroid
		const dists = points.map((p) => {
			let minD = Infinity;
			for (const centroid of centroids) {
				const d = cosineDistance(p, centroid);
				if (d < minD) minD = d;
			}
			return minD * minD;
		});
		const total = dists.reduce((s, d) => s + d, 0);
		// Pick deterministically: farthest-first rather than probabilistic sampling.
		// Stable across runs and improves test reproducibility.
		let best = 0;
		let bestVal = -1;
		for (let i = 0; i < dists.length; i++) {
			if (dists[i] > bestVal) {
				bestVal = dists[i];
				best = i;
			}
		}
		// Avoid duplicate centroid
		if (total === 0) break;
		centroids.push(new Float32Array(points[best]));
	}

	let assignments = new Int32Array(points.length).fill(-1);

	for (let iter = 0; iter < 100; iter++) {
		// Assign each point to nearest centroid
		const newAssignments = new Int32Array(points.length);
		for (let i = 0; i < points.length; i++) {
			let minD = Infinity;
			let minC = 0;
			for (let c = 0; c < centroids.length; c++) {
				const d = cosineDistance(points[i], centroids[c]);
				if (d < minD) {
					minD = d;
					minC = c;
				}
			}
			newAssignments[i] = minC;
		}

		// Check convergence
		let changed = false;
		for (let i = 0; i < assignments.length; i++) {
			if (assignments[i] !== newAssignments[i]) {
				changed = true;
				break;
			}
		}
		assignments = newAssignments;
		if (!changed) break;

		// Recompute centroids
		for (let c = 0; c < centroids.length; c++) {
			const members = [];
			for (let i = 0; i < assignments.length; i++) {
				if (assignments[i] === c) members.push(i);
			}
			if (members.length === 0) continue;
			const newCentroid = new Float32Array(dim);
			for (const idx of members) {
				for (let d = 0; d < dim; d++) {
					newCentroid[d] += points[idx][d];
				}
			}
			for (let d = 0; d < dim; d++) {
				newCentroid[d] /= members.length;
			}
			centroids[c] = newCentroid;
		}
	}

	// Build result clusters
	const clusters: KmeansCluster[] = centroids.map((centroid) => ({ centroid, members: [] }));
	for (let i = 0; i < assignments.length; i++) {
		clusters[assignments[i]].members.push(i);
	}
	return clusters.filter((cl) => cl.members.length > 0);
}

// Atomically replace all cluster rows with a fresh clustering run.
export function refreshClusters(latticeDb: Database): void {
	const store = getQmdStore();
	if (!store) {
		console.warn('[cluster] refreshClusters: QMD store not available, skipping');
		return;
	}

	const qmdDb = store.internal.db as Database;
	const docs = readEmbeddedDocs(qmdDb, latticeDb);
	if (docs.length < 2) return;

	const k = Math.min(Math.max(Math.round(Math.sqrt(docs.length)), 2), 20);
	const clusters = kmeans(
		docs.map((d) => d.vector),
		k,
	);

	const now = new Date().toISOString();

	latticeDb.exec('BEGIN');
	try {
		latticeDb.exec('DELETE FROM clusters');
		const insertCluster = latticeDb.prepare<unknown, [string]>(
			`INSERT INTO clusters (run_at, label) VALUES (?, NULL)`,
		);
		const insertMembership = latticeDb.prepare<unknown, [number, string, string]>(
			`INSERT OR IGNORE INTO cluster_memberships (cluster_id, target_kind, target_id) VALUES (?, ?, ?)`,
		);
		for (const cluster of clusters) {
			const { lastInsertRowid } = insertCluster.run(now);
			const clusterId = Number(lastInsertRowid);
			for (const memberIdx of cluster.members) {
				const doc = docs[memberIdx];
				insertMembership.run(clusterId, doc.targetKind, doc.targetId);
			}
		}
		latticeDb.exec('COMMIT');
	} catch (err) {
		latticeDb.exec('ROLLBACK');
		throw err;
	}
}

interface ResurfaceCandidate {
	targetKind: string;
	targetId: string;
	reason: string;
}

function getDocAge(latticeDb: Database, targetKind: string, targetId: string): Date {
	if (targetKind === 'capture') {
		const row = latticeDb
			.query<{ ingested_at: string }, [number]>(`SELECT ingested_at FROM captures WHERE id = ?`)
			.get(parseInt(targetId, 10));
		if (row) return new Date(row.ingested_at);
	} else if (targetKind === 'working') {
		try {
			const filePath = join(workingDir(), `${targetId}.md`);
			if (existsSync(filePath)) {
				return statSync(filePath).mtime;
			}
		} catch (err) {
			console.warn('[cluster] getDocAge: could not stat working doc', targetId, err);
		}
	} else if (targetKind === 'local-file') {
		const row = latticeDb
			.query<{ modified_at: string }, [string]>(`SELECT modified_at FROM file_index WHERE path = ?`)
			.get(targetId);
		if (row) return new Date(row.modified_at);
	}
	return new Date(0);
}

// Select one item per cluster for resurfacing, per spec F3.
// Eligible = not surfaced in the last 7 days.
// Rank: never-surfaced first (within each tier, oldest by document age).
export function selectResurfaceItems(latticeDb: Database): ResurfaceCandidate[] {
	type MemberRow = { cluster_id: number; target_kind: string; target_id: string };
	const members = latticeDb
		.query<MemberRow, []>(`SELECT cluster_id, target_kind, target_id FROM cluster_memberships`)
		.all();

	// Group by cluster
	const byCluster = new Map<number, MemberRow[]>();
	for (const m of members) {
		const list = byCluster.get(m.cluster_id) ?? [];
		list.push(m);
		byCluster.set(m.cluster_id, list);
	}

	const candidates: ResurfaceCandidate[] = [];

	for (const [, clusterMembers] of byCluster) {
		// Find the best eligible member for this cluster
		// Eligible = no surfaced row with surfaced_at >= 7 days ago
		interface ScoredMember {
			member: MemberRow;
			neverSurfaced: boolean;
			age: Date;
		}
		const eligible: ScoredMember[] = [];

		for (const member of clusterMembers) {
			// Check 7-day recency skip
			const recentRow = latticeDb
				.query<{ id: number }, [string, string]>(
					`SELECT id FROM surfaced
					 WHERE target_kind = ? AND target_id = ?
					   AND surfaced_at >= datetime('now', '-7 days')
					 LIMIT 1`,
				)
				.get(member.target_kind, member.target_id);
			if (recentRow) continue; // skip — surfaced within 7 days

			const anyRow = latticeDb
				.query<
					{ id: number },
					[string, string]
				>(`SELECT id FROM surfaced WHERE target_kind = ? AND target_id = ? LIMIT 1`)
				.get(member.target_kind, member.target_id);

			eligible.push({
				member,
				neverSurfaced: !anyRow,
				age: getDocAge(latticeDb, member.target_kind, member.target_id),
			});
		}

		if (eligible.length === 0) continue;

		// Sort: never-surfaced first, then oldest within each tier
		eligible.sort((a, b) => {
			if (a.neverSurfaced !== b.neverSurfaced) return a.neverSurfaced ? -1 : 1;
			return a.age.getTime() - b.age.getTime();
		});

		const pick = eligible[0];
		const reason = pick.neverSurfaced ? 'Not visited in a while' : 'Been a while';
		candidates.push({
			targetKind: pick.member.target_kind,
			targetId: pick.member.target_id,
			reason,
		});
	}

	return candidates;
}

// Idempotent nightly resurfacing pass.
export function runResurfacePass(latticeDb: Database): void {
	// Ensure clusters exist
	const clusterCount = (
		latticeDb.query<{ n: number }, []>(`SELECT COUNT(*) AS n FROM clusters`).get() ?? { n: 0 }
	).n;
	if (clusterCount === 0) {
		refreshClusters(latticeDb);
	}

	const candidates = selectResurfaceItems(latticeDb);
	const now = new Date().toISOString();

	const insertStmt = latticeDb.prepare<unknown, [string, string, string, string]>(
		`INSERT INTO surfaced (target_kind, target_id, surfaced_at, reason) VALUES (?, ?, ?, ?)`,
	);

	for (const c of candidates) {
		const existing = latticeDb
			.query<{ id: number }, [string, string]>(
				`SELECT id FROM surfaced
				 WHERE target_kind = ? AND target_id = ?
				   AND DATE(surfaced_at,'localtime') = DATE('now','localtime')
				 LIMIT 1`,
			)
			.get(c.targetKind, c.targetId);
		if (existing) continue;

		insertStmt.run(c.targetKind, c.targetId, now, c.reason);
	}
}
