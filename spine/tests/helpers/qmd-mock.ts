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
}

export interface FakeStoreHandle {
  state: FakeStoreState;
  setHits(hits: FakeSearchHit[]): void;
  setNeedsEmbedding(n: number): void;
  setUpdateError(err: Error | null): void;
  setSearchError(err: Error | null): void;
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
  };

  const fakeStore = {
    async update() {
      state.updateCalls++;
      if (state.updateThrows) throw state.updateThrows;
      return { needsEmbedding: state.needsEmbedding };
    },
    async embed() {
      state.embedCalls++;
    },
    async search() {
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
  };

  return handle;
}

export function getQmdHandle(): FakeStoreHandle {
  if (!handle) throw new Error("installQmdMock() must be called first");
  return handle;
}
