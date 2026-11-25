// Robust static server for the screen tests.
//
// `python -m http.server` refuses connections when the game asks for its ~500 scripts at once on a busy
// machine (seen on Windows: 854 of 1500 parallel requests refused). Each refused script shows up as a
// fake page error like "CLANS is not defined" or "HOLDRULE is not defined". Node's server takes them all.
//
// Usage:  node serve.js PORT [DIR]        (DIR defaults to ../game next to this file)
const http = require("http"), fs = require("fs"), path = require("path");
const port = +(process.argv[2] || 8765);
const root = path.resolve(process.argv[3] || path.join(__dirname, "..", "game"));
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json",
  ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon",
  ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".webmanifest": "application/manifest+json",
};
const server = http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split("?")[0]); } catch (e) { res.writeHead(400); return res.end(); }
  if (p.endsWith("/")) p += "index.html";
  const f = path.join(root, p);
  if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
  fs.stat(f, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(f).toLowerCase()] || "application/octet-stream", "Content-Length": st.size, "Cache-Control": "no-store" });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(f).pipe(res);
  });
});
server.listen({ port, host: "127.0.0.1", backlog: 2048 }, () => console.log(`serving ${root} on ${port}`));
