// Postgres storage (Railway sets DATABASE_URL). Tables are created on first start. Times are stored as epoch milliseconds.
"use strict";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS accounts (
  id text PRIMARY KEY,
  username text NOT NULL,
  username_lc text NOT NULL UNIQUE,
  pass_hash text NOT NULL,
  email text,
  created_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  device_id text NOT NULL,
  device_name text NOT NULL,
  created_at bigint NOT NULL,
  last_seen bigint NOT NULL,
  revoked_at bigint,
  revoked_by text
);
CREATE INDEX IF NOT EXISTS sessions_live ON sessions (account_id) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS characters (
  id text PRIMARY KEY,
  account_id text NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  level integer NOT NULL DEFAULT 1,
  race text,
  data jsonb NOT NULL,
  version integer NOT NULL,
  updated_at bigint NOT NULL,
  deleted_at bigint
);
CREATE INDEX IF NOT EXISTS characters_account ON characters (account_id) WHERE deleted_at IS NULL;
`;

function pgStore(url, opts = {}) {
  const { Pool } = require("pg");
  const ssl = opts.ssl ?? (/localhost|127\.0\.0\.1|\.railway\.internal/.test(url) ? false : { rejectUnauthorized: false });
  const pool = new Pool({ connectionString: url, ssl, max: opts.max || 8 });
  const q = (text, args) => pool.query(text, args);
  const n = (v) => (v == null ? null : Number(v));
  const acc = (r) => (r ? { id: r.id, username: r.username, usernameLc: r.username_lc, passHash: r.pass_hash, email: r.email, createdAt: n(r.created_at) } : null);
  const ses = (r) => (r ? { id: r.id, accountId: r.account_id, tokenHash: r.token_hash, deviceId: r.device_id, deviceName: r.device_name, createdAt: n(r.created_at), lastSeen: n(r.last_seen), revokedAt: n(r.revoked_at), revokedBy: r.revoked_by } : null);
  const chr = (r) => (r ? { id: r.id, accountId: r.account_id, name: r.name, level: r.level, race: r.race, version: r.version, updatedAt: n(r.updated_at), deletedAt: n(r.deleted_at) } : null);
  return {
    kind: "postgres",
    async init() { await q(SCHEMA); },
    async close() { await pool.end(); },
    async createAccount({ id, username, usernameLc, passHash, now }) {
      const r = await q(`INSERT INTO accounts (id, username, username_lc, pass_hash, created_at) VALUES ($1,$2,$3,$4,$5)
                         ON CONFLICT (username_lc) DO NOTHING RETURNING *`, [id, username, usernameLc, passHash, now]);
      return acc(r.rows[0]);
    },
    async accountByName(lc) { return acc((await q("SELECT * FROM accounts WHERE username_lc=$1", [lc])).rows[0]); },
    async accountById(id) { return acc((await q("SELECT * FROM accounts WHERE id=$1", [id])).rows[0]); },
    async createSession({ id, accountId, tokenHash, deviceId, deviceName, now }) {
      const r = await q(`INSERT INTO sessions (id, account_id, token_hash, device_id, device_name, created_at, last_seen) VALUES ($1,$2,$3,$4,$5,$6,$6) RETURNING *`,
        [id, accountId, tokenHash, deviceId, deviceName, now]);
      return ses(r.rows[0]);
    },
    async sessionByToken(hash) { return ses((await q("SELECT * FROM sessions WHERE token_hash=$1", [hash])).rows[0]); },
    async liveSessions(accountId) { return (await q("SELECT * FROM sessions WHERE account_id=$1 AND revoked_at IS NULL ORDER BY last_seen DESC", [accountId])).rows.map(ses); },
    async revokeSessions(accountId, { exceptId = null, by = null, now }) {
      const r = await q("UPDATE sessions SET revoked_at=$3, revoked_by=$4 WHERE account_id=$1 AND revoked_at IS NULL AND ($2::text IS NULL OR id<>$2)", [accountId, exceptId, now, by]);
      return r.rowCount;
    },
    async revokeSession(id, { by = null, now }) { await q("UPDATE sessions SET revoked_at=$2, revoked_by=$3 WHERE id=$1 AND revoked_at IS NULL", [id, now, by]); },
    async touchSession(id, now) { await q("UPDATE sessions SET last_seen=$2 WHERE id=$1", [id, now]); },
    async listCharacters(accountId) {
      return (await q("SELECT id, account_id, name, level, race, version, updated_at, deleted_at FROM characters WHERE account_id=$1 AND deleted_at IS NULL ORDER BY updated_at DESC", [accountId])).rows.map(chr);
    },
    async countCharacters(accountId) { return Number((await q("SELECT count(*) FROM characters WHERE account_id=$1 AND deleted_at IS NULL", [accountId])).rows[0].count); },
    async getCharacter(id) { const r = (await q("SELECT * FROM characters WHERE id=$1", [id])).rows[0]; return r ? { ...chr(r), data: r.data } : null; },
    /* the version check and the write happen in one transaction with the row locked, so two saves can't both win */
    async saveCharacter({ id, accountId, name, level, race, json, baseVersion, force, now }) {
      const c = await pool.connect();
      try {
        await c.query("BEGIN");
        const cur = (await c.query("SELECT id, account_id, name, level, race, version, updated_at, deleted_at FROM characters WHERE id=$1 FOR UPDATE", [id])).rows[0];
        if (cur && cur.account_id !== accountId) { await c.query("ROLLBACK"); return { notYours: true }; }
        if (cur && cur.deleted_at == null && !force && (baseVersion | 0) !== cur.version) { await c.query("ROLLBACK"); return { conflict: true, server: chr(cur) }; }
        const version = cur ? cur.version + 1 : 1;
        await c.query(`INSERT INTO characters (id, account_id, name, level, race, data, version, updated_at, deleted_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,NULL)
                       ON CONFLICT (id) DO UPDATE SET name=$3, level=$4, race=$5, data=$6::jsonb, version=$7, updated_at=$8, deleted_at=NULL`,
          [id, accountId, name, level, race, json, version, now]);
        await c.query("COMMIT");
        return { ok: true, version };
      } catch (e) { try { await c.query("ROLLBACK"); } catch { /* already gone */ } throw e; } finally { c.release(); }
    },
    async deleteCharacter(id, accountId, now) {
      const r = await q("UPDATE characters SET deleted_at=$3 WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL", [id, accountId, now]);
      return r.rowCount > 0;
    },
  };
}
module.exports = { pgStore, SCHEMA };
