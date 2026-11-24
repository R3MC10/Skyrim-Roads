// Passwords, tokens and ids. Passwords are kept only as salted scrypt hashes; session tokens only as SHA-256.
"use strict";
const crypto = require("crypto");

const SCRYPT = { N: 16384, r: 8, p: 1, len: 64 };

function scrypt(password, salt, o = SCRYPT) {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, o.len, { N: o.N, r: o.r, p: o.p, maxmem: 64 * 1024 * 1024 }, (err, key) => (err ? reject(err) : resolve(key))));
}
/* "scrypt$N$r$p$salt$hash" (base64) */
async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(String(password).normalize("NFKC"), salt);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}
async function checkPassword(password, stored) {
  const parts = String(stored || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const want = Buffer.from(hashB64, "base64");
  const got = await scrypt(String(password).normalize("NFKC"), Buffer.from(saltB64, "base64"), { N: +N, r: +r, p: +p, len: want.length });
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
/* a dummy check of the same cost, so "no such user" takes as long as "wrong password" */
let DUMMY = null;
async function burn(password) { DUMMY = DUMMY || (await hashPassword("x".repeat(12))); await checkPassword(password, DUMMY); }

const newToken = () => crypto.randomBytes(32).toString("base64url");
const tokenHash = (t) => crypto.createHash("sha256").update(String(t)).digest("hex");
const newId = (prefix) => `${prefix}_${crypto.randomBytes(12).toString("hex")}`;

module.exports = { hashPassword, checkPassword, burn, newToken, tokenHash, newId };
