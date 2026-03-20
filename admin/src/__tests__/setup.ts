import '@testing-library/jest-dom/vitest'

// Node.js 25 has a built-in localStorage without standard Storage methods.
// Polyfill with a proper Storage implementation for tests.
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.getItem !== 'function') {
  const store = new Map<string, string>()
  const storage: Storage = {
    getItem(key: string) { return store.get(key) ?? null },
    setItem(key: string, value: string) { store.set(key, value) },
    removeItem(key: string) { store.delete(key) },
    clear() { store.clear() },
    key(index: number) { return [...store.keys()][index] ?? null },
    get length() { return store.size },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true, configurable: true })
}
