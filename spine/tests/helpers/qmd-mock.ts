import { mock } from "bun:test";

export interface FakeSearchHit {
  file: string;
  score: number;
  bestChunk: string;
  body: string;
  displayPath: string;
}

interface FakeStoreState {
  updateCalls: number;
  embedCalls: number;
  needsEmbedding: number;
  searchHits: FakeSearchHit[];
  searchThrows: Error | null;
  updateThrows: Error | null;
  lastSearchArgs: unknown;
  // Live count of update() invocations currently in flight, and the
  // high-water mark observed. Used to assert refreshIndex serialization.
  inflightUpdates: number;
  maxConcurrentUpdates: number;
  // When >0, update() awaits this many ms before returning so that
  // concurrency assertions actually have time to observe overlap.
  updateDelayMs: number;
}

export interface FakeStoreHandle {
  state: FakeStoreState;
  setHits(hits: FakeSearchHit[]): void;
  setNeedsEmbedding(n: number): void;
  setUpdateError(err: Error | null): void;
  setSearchError(err: Error | null): void;
  setUpdateDelay(ms: number): void;
  getLastSearchArgs(): unknown;
}

let handle: FakeStoreHandle | null = null;

// Install a mock for "@tobilu/qmd" before any module that imports it.
// Returns a handle for the test to manipulate the fake store's behavior.
//
// Call exactly once per test file, before importing src/search.ts.
export function installQmdMock(): FakeStoreHandle {
  const state: FakeStoreState = {
    updateCalls: 0,
    embedCalls: 0,
    needsEmbedding: 0,
    searchHits: [],
    searchThrows: null,
    updateThrows: null,
    lastSearchArgs: undefined,
    inflightUpdates: 0,
    maxConcurrentUpdates: 0,
    updateDelayMs: 0,
  };

  const fakeStore = {
    async update() {
      state.updateCalls++;
      state.inflightUpdates++;
      if (state.inflightUpdates > state.maxConcurrentUpdates) {
        state.maxConcurrentUpdates = state.inflightUpdates;
      }
      try {
        if (state.updateDelayMs > 0) {
          await new Promise((r) => setTimeout(r, state.updateDelayMs));
        }
        if (state.updateThrows) throw state.updateThrows;
        return { needsEmbedding: state.needsEmbedding };
      } finally {
        state.inflightUpdates--;
      }
    },
    async embed() {
      state.embedCalls++;
    },
    async search(args: unknown) {
      state.lastSearchArgs = args;
      if (state.searchThrows) throw state.searchThrows;
      return state.searchHits;
    },
  };

  mock.module("@tobilu/qmd", () => ({
    createStore: async () => fakeStore,
  }));

  handle = {
    state,
    setHits(hits) {
      state.searchHits = hits;
    },
    setNeedsEmbedding(n) {
      state.needsEmbedding = n;
    },
    setUpdateError(err) {
      state.updateThrows = err;
    },
    setSearchError(err) {
      state.searchThrows = err;
    },
    setUpdateDelay(ms) {
      state.updateDelayMs = ms;
    },
    getLastSearchArgs() {
      return state.lastSearchArgs;
    },
  };

  return handle;
}

export function getQmdHandle(): FakeStoreHandle {
  if (!handle) throw new Error("installQmdMock() must be called first");
  return handle;
}
