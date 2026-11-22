(() => {
  const store = new Map(), L = {};
  const colOf = (p) => p.split("/").slice(0, -1).join("/");
  const emit = (col) => (L[col] || []).forEach((cb) => cb({ docs: [...store.entries()].filter(([p]) => colOf(p) === col).map(([p, v]) => ({ id: p.split("/").pop(), data: () => JSON.parse(JSON.stringify(v)) })) }));
  const db = {
    doc: (p) => ({
      get: async () => ({ exists: store.has(p), data: () => JSON.parse(JSON.stringify(store.get(p))) }),
      set: async (v) => { store.set(p, JSON.parse(JSON.stringify(v))); setTimeout(() => emit(colOf(p)), 0); },
      delete: async () => { store.delete(p); setTimeout(() => emit(colOf(p)), 0); },
      acquire: async () => ({ acquired: true }),
    }),
    collection: (c) => ({ onSnapshot: (cb) => { (L[c] = L[c] || []).push(cb); setTimeout(() => emit(c), 0); return () => {}; } }),
  };
  window.__fakedb = { store, emit, db };
  window.claude = { use: async (n) => n === "db" ? db : n === "user" ? { id: async () => "U1", can: () => true } : null };
})();
