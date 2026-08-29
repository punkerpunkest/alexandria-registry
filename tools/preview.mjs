// Serves dist/ for a local look. Not used in production — Vercel serves the files
// directly, and the redirect rules here only mimic what `cleanUrls` does there.
import http from 'node:http';
import fs from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const PORT = Number(process.env.PORT || 4321);
const TYPES = { '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.webp':'image/webp',
                '.woff2':'font/woff2', '.svg':'image/svg+xml', '.html':'text/html' };

http.createServer((req, res) => {
  let path = join(OUT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(path) && fs.statSync(path).isDirectory()) path = join(path, 'index.html');
  else if (!fs.existsSync(path) && fs.existsSync(path + '.html')) path += '.html';

  let body;
  try { body = fs.readFileSync(path); }
  catch { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); return; }

  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' });
  res.end(body);
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
