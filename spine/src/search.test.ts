import { afterEach, expect, test } from 'bun:test';
import type { QMDStore } from '@tobilu/qmd';
import {
	search,
	searchRelated,
	refreshIndex,
	isSearchDegraded,
	needsEmbeddingCount,
	__resetSearchForTests,
	__setStoreForTests,
	__runBackfillForTests,
	__awaitIndexLockForTests,
} from './search';

afterEach(() => {
	__resetSearchForTests();
});

// A hybrid hit, shaped as QMD's search() output (consumed by mapResults).
function hybridHit(slug: string, body: string) {
	return {
		file: `qmd://working/${slug}.md`,
		score: 0.9,
		bestChunk: body.slice(0, 20),
		body,
		displayPath: `working/${slug}.md`,
	};
}

// An FTS row, shaped as QMD's searchLex() output.
function ftsRow(slug: string, body: string) {
	return {
		filepath: `qmd://working/${slug}.md`,
		displayPath: `working/${slug}.md`,
		title: slug,
		hash: slug,
		docid: `#${slug}`,
		collectionName: 'working',
		modifiedAt: '',
		bodyLength: body.length,
		body,
		context: null,
		score: 0.5,
		source: 'fts' as const,
	};
}

type StoreBehavior = {
	search: () => Promise<unknown>;
	searchLex: () => Promise<unknown>;
	embed: () => Promise<unknown>;
	update: () => Promise<{ needsEmbedding: number }>;
	getIndexHealth: () => Promise<{ needsEmbedding: number; totalDocs: number; daysStale: null }>;
};

/** Build a fake QMDStore. Counters always increment; overrides supply behavior. */
function fakeStore(overrides: Partial<StoreBehavior> = {}) {
	const calls = { search: 0, searchLex: 0, embed: 0, update: 0, getIndexHealth: 0 };
	const behavior: StoreBehavior = {
		search: async () => [hybridHit('alpha', 'alpha body via remote')],
		searchLex: async () => [ftsRow('beta', 'beta body via bm25')],
		embed: async () => ({ embedded: 0, failures: [] }),
		update: async () => ({ needsEmbedding: 0 }),
		getIndexHealth: async () => ({ needsEmbedding: 0, totalDocs: 0, daysStale: null }),
		...overrides,
	};
	const store = {
		search: async () => {
			calls.search++;
			return behavior.search();
		},
		searchLex: async () => {
			calls.searchLex++;
			return behavior.searchLex();
		},
		embed: async () => {
			calls.embed++;
			return behavior.embed();
		},
		update: async () => {
			calls.update++;
			return behavior.update();
		},
		getIndexHealth: async () => {
			calls.getIndexHealth++;
			return behavior.getIndexHealth();
		},
	} as unknown as QMDStore;
	return { store, calls };
}

test('full-quality path returns remote results with degraded=false', async () => {
	const { store, calls } = fakeStore();
	__setStoreForTests(store);

	const res = await search('anything');

	expect(res.degraded).toBe(false);
	expect(isSearchDegraded()).toBe(false);
	expect(calls.search).toBe(1);
	expect(calls.searchLex).toBe(0);
	expect(res.results).toHaveLength(1);
	expect(res.results[0]).toMatchObject({ kind: 'working', slug: 'alpha' });
});

test('endpoint failure degrades to BM25 keyword-only with degraded=true', async () => {
	const { store, calls } = fakeStore({
		search: async () => {
			throw new Error('Remote embedding circuit breaker is open');
		},
	});
	__setStoreForTests(store);

	const res = await search('anything');

	expect(res.degraded).toBe(true);
	expect(isSearchDegraded()).toBe(true);
	expect(calls.searchLex).toBe(1); // fell back to lexical
	expect(res.results).toHaveLength(1);
	expect(res.results[0]).toMatchObject({ kind: 'working', slug: 'beta' });
	expect(res.results[0].snippet.length).toBeGreaterThan(0);
});

test('search returns empty (not throwing) when store is uninitialized', async () => {
	const res = await search('anything');
	expect(res.results).toEqual([]);
});

test('backfill embeds pending docs once and clears degraded on recovery', async () => {
	let pending = 3;
	const { store, calls } = fakeStore({
		embed: async () => {
			pending = 0; // endpoint recovered, all embedded
			return { embedded: 3, failures: [] };
		},
		getIndexHealth: async () => ({ needsEmbedding: pending, totalDocs: 3, daysStale: null }),
	});
	__setStoreForTests(store);

	await __runBackfillForTests();

	expect(calls.embed).toBe(1);
	expect(isSearchDegraded()).toBe(false);
	expect(await needsEmbeddingCount()).toBe(0);
});

test('backfill stays degraded and does not crash when endpoint is still down', async () => {
	const { store, calls } = fakeStore({
		embed: async () => {
			throw new Error('endpoint still unavailable');
		},
		getIndexHealth: async () => ({ needsEmbedding: 5, totalDocs: 5, daysStale: null }),
	});
	__setStoreForTests(store);

	await __runBackfillForTests();

	expect(calls.embed).toBe(1);
	expect(isSearchDegraded()).toBe(true);
});

test('backfill is a no-op when nothing needs embedding', async () => {
	const { store, calls } = fakeStore({
		getIndexHealth: async () => ({ needsEmbedding: 0, totalDocs: 10, daysStale: null }),
	});
	__setStoreForTests(store);

	await __runBackfillForTests();

	expect(calls.embed).toBe(0);
	expect(isSearchDegraded()).toBe(false);
});

test('related-items search skips expansion/rerank and degrades to BM25 when the endpoint is down', async () => {
	const { store, calls } = fakeStore({
		search: async () => {
			throw new Error('Remote embedding circuit breaker is open');
		},
	});
	__setStoreForTests(store);

	const results = await searchRelated('a document body\nwith newlines and "quotes');

	// Uses the lightweight lex+vec path (not the single-query expand+rerank pipeline),
	// then falls back to BM25 on failure.
	expect(calls.searchLex).toBe(1);
	expect(isSearchDegraded()).toBe(true);
	expect(results[0]).toMatchObject({ kind: 'working', slug: 'beta' });
});

// Headline Done criterion: a capture made while the endpoint is down is keyword-findable
// immediately (lexical update persisted) and gains vector coverage after recovery.
test('write path: index lexically when embedding fails, then backfill on recovery', async () => {
	let pending = 0;
	let endpointUp = false; // endpoint is down at capture time
	const { store, calls } = fakeStore({
		update: async () => {
			pending = 1; // a new doc was indexed lexically and now needs embedding
			return { needsEmbedding: pending };
		},
		search: async () => {
			// Remote pipeline (expand/vec/rerank) is unreachable while the endpoint is down.
			if (!endpointUp) throw new Error('Remote embedding circuit breaker is open');
			return [hybridHit('beta', 'beta body via remote')];
		},
		embed: async () => {
			if (!endpointUp) throw new Error('endpoint down');
			pending = 0; // recovered: doc embedded
			return { embedded: 1, failures: [] };
		},
		getIndexHealth: async () => ({ needsEmbedding: pending, totalDocs: 1, daysStale: null }),
	});
	__setStoreForTests(store);

	// Capture-time refresh: lexical index succeeds, embedding fails (endpoint down).
	refreshIndex();
	await __awaitIndexLockForTests();
	expect(calls.update).toBe(1); // lexical index persisted -> keyword-findable now
	expect(calls.embed).toBe(1); // embedding attempted
	expect(isSearchDegraded()).toBe(true);

	// The doc is keyword-findable immediately via the degraded BM25 path.
	const found = await search('beta');
	expect(found.degraded).toBe(true);
	expect(found.results.length).toBeGreaterThan(0);

	// Endpoint recovers; backfill embeds the pending doc and clears degraded.
	endpointUp = true;
	await __runBackfillForTests();
	expect(isSearchDegraded()).toBe(false);
	expect(await needsEmbeddingCount()).toBe(0);
});
