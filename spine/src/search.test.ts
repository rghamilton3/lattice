import { afterEach, expect, test } from 'bun:test';
import type { QMDStore } from '@tobilu/qmd';
import {
	search,
	searchRelated,
	refreshIndex,
	isSearchDegraded,
	needsEmbeddingCount,
	stopEmbeddingBackfill,
	__resetSearchForTests,
	__setStoreForTests,
	__runBackfillForTests,
	__awaitIndexLockForTests,
	__getBackfillDelayForTests,
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

	const res = await searchRelated('a document body\nwith newlines and "quotes');

	// Uses the lightweight lex+vec path (not the single-query expand+rerank pipeline),
	// then falls back to BM25 on failure and reports degraded through the response.
	expect(calls.searchLex).toBe(1);
	expect(res.degraded).toBe(true);
	expect(isSearchDegraded()).toBe(true);
	expect(res.results[0]).toMatchObject({ kind: 'working', slug: 'beta' });
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

// A backfill pass with nothing pending makes no inference call, so it cannot confirm
// recovery — it must leave a degraded flag (set by a failed live search) untouched.
test('backfill leaves degraded set when there is no pending work to probe recovery', async () => {
	const { store, calls } = fakeStore({
		search: async () => {
			throw new Error('Remote embedding circuit breaker is open');
		},
		getIndexHealth: async () => ({ needsEmbedding: 0, totalDocs: 5, daysStale: null }),
	});
	__setStoreForTests(store);

	// A failed live search marks the endpoint degraded.
	await search('anything');
	expect(isSearchDegraded()).toBe(true);

	// Backfill finds nothing to embed: it must NOT clear degraded.
	await __runBackfillForTests();
	expect(calls.embed).toBe(0);
	expect(isSearchDegraded()).toBe(true);
});

test('backfill backoff doubles on repeated failure and caps at the maximum', async () => {
	const { store } = fakeStore({
		embed: async () => {
			throw new Error('endpoint still unavailable');
		},
		getIndexHealth: async () => ({ needsEmbedding: 5, totalDocs: 5, daysStale: null }),
	});
	__setStoreForTests(store);

	const delays: number[] = [];
	for (let i = 0; i < 12; i++) {
		await __runBackfillForTests();
		delays.push(__getBackfillDelayForTests());
		// Cancel the timer the failed pass scheduled so it cannot fire during the test.
		stopEmbeddingBackfill();
	}

	// 30s base → 60s → 120s ... doubling, capped at the 10-minute maximum.
	expect(delays[0]).toBe(60_000);
	expect(delays[1]).toBe(120_000);
	expect(delays[delays.length - 1]).toBe(10 * 60_000);
	for (let i = 1; i < delays.length; i++) {
		expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
	}
});

test('backfill resets backoff to the minimum after a successful embed', async () => {
	let down = true;
	let pending = 5;
	const { store } = fakeStore({
		embed: async () => {
			if (down) throw new Error('endpoint down');
			pending = 0;
			return { embedded: 5, failures: [] };
		},
		getIndexHealth: async () => ({ needsEmbedding: pending, totalDocs: 5, daysStale: null }),
	});
	__setStoreForTests(store);

	await __runBackfillForTests(); // fails → backoff doubles to 60s
	stopEmbeddingBackfill();
	expect(__getBackfillDelayForTests()).toBe(60_000);

	down = false;
	await __runBackfillForTests(); // succeeds → backoff resets to the 30s minimum
	stopEmbeddingBackfill();
	expect(__getBackfillDelayForTests()).toBe(30_000);
	expect(isSearchDegraded()).toBe(false);
});
