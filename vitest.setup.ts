if (typeof window !== 'undefined') {
  const store = new Map<string, string>()
  const storage: Storage = {
    get length() { return store.size },
    clear() { store.clear() },
    getItem(key: string) { return store.get(String(key)) ?? null },
    key(index: number) { return [...store.keys()][index] ?? null },
    removeItem(key: string) { store.delete(String(key)) },
    setItem(key: string, value: string) { store.set(String(key), String(value)) },
  }
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true })
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true, writable: true })
}
