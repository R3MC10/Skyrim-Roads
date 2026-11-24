// In-memory storage with the same functions as the Postgres one. Used by the tests and by local runs without a database.
// Everything is gone when the process stops.
"use strict";

function memoryStore() {
  const accounts = new Map(), byName = new Map(), sessions = new Map(), byToken = new Map(), chars = new Map(), worldRecs = new Map(), reports = [];
  const copy = (o) => (o ? JSON.parse(JSON.stringify(o)) : null);
  const summary = (c) => ({ id: c.id, accountId: c.accountId, name: c.name, level: c.level, race: c.race, version: c.version, updatedAt: c.updatedAt, deletedAt: c.deletedAt || null });
  return {
    kind: "memory",
    async init() {},
    async close() {},
    async createAccount({ id, username, usernameLc, passHash, now }) {
      if (byName.has(usernameLc)) return null;
      const a = { id, username, usernameLc, passHash, email: null, createdAt: now };
      accounts.set(id, a); byName.set(usernameLc, id);
      return copy(a);
    },
    async accountByName(lc) { return copy(accounts.get(byName.get(lc))); },
    async accountById(id) { return copy(accounts.get(id)); },
    async createSession({ id, accountId, tokenHash, deviceId, deviceName, now }) {
      const s = { id, accountId, tokenHash, deviceId, deviceName, createdAt: now, lastSeen: now, revokedAt: null, revokedBy: null };
      sessions.set(id, s); byToken.set(tokenHash, id);
      return copy(s);
    },
    async sessionByToken(hash) { return copy(sessions.get(byToken.get(hash))); },
    async liveSessions(accountId) { return [...sessions.values()].filter((s) => s.accountId === accountId && !s.revokedAt).map(copy); },
    async revokeSessions(accountId, { exceptId = null, by = null, now }) {
      let n = 0;
      for (const s of sessions.values()) if (s.accountId === accountId && !s.revokedAt && s.id !== exceptId) { s.revokedAt = now; s.revokedBy = by; n++; }
      return n;
    },
    async revokeSession(id, { by = null, now }) { const s = sessions.get(id); if (s && !s.revokedAt) { s.revokedAt = now; s.revokedBy = by; } },
    async touchSession(id, now) { const s = sessions.get(id); if (s) s.lastSeen = now; },
    async listCharacters(accountId) { return [...chars.values()].filter((c) => c.accountId === accountId && !c.deletedAt).map(summary).sort((a, b) => b.updatedAt - a.updatedAt); },
    async countCharacters(accountId) { return [...chars.values()].filter((c) => c.accountId === accountId && !c.deletedAt).length; },
    async getCharacter(id) { const c = chars.get(id); return c ? { ...summary(c), data: JSON.parse(c.json) } : null; },
    /* one save, checked against the version the device last saw (all in one step, like the Postgres transaction) */
    async saveCharacter({ id, accountId, name, level, race, json, baseVersion, force, now }) {
      const c = chars.get(id);
      if (c && c.accountId !== accountId) return { notYours: true };
      if (c && !c.deletedAt && !force && (baseVersion | 0) !== c.version) return { conflict: true, server: summary(c) };
      const version = c ? c.version + 1 : 1;
      chars.set(id, { id, accountId, name, level, race, json, version, updatedAt: now, deletedAt: null });
      return { ok: true, version };
    },
    /* the shared world (hub.js): rows of {col, id, doc}; doc null deletes */
    async loadWorld() { return [...worldRecs.entries()].map(([k, doc]) => { const [col, id] = k.split("\u0000"); return { col, id, doc: JSON.parse(doc) }; }); },
    async putWorld(rows) { for (const { col, id, doc } of rows) { const k = col + "\u0000" + id; if (doc == null) worldRecs.delete(k); else worldRecs.set(k, JSON.stringify(doc)); } },
    async saveReport({ id, at, report }) { reports.push({ id, at, report: copy(report) }); if (reports.length > 500) reports.shift(); },   // player reports kept when GitHub can't take them
    async listReports(limit = 50) { return reports.slice(-limit).reverse().map(copy); },
    async deleteCharacter(id, accountId, now) { const c = chars.get(id); if (!c || c.accountId !== accountId || c.deletedAt) return false; c.deletedAt = now; return true; },
  };
}
module.exports = { memoryStore };
