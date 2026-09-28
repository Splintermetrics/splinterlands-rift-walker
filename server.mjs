import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const types = { '.html':'text/html', '.js':'text/javascript', '.mjs':'text/javascript', '.css':'text/css', '.json':'application/json', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml' };
const cache = new Map();
const server = http.createServer(async (req,res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/collection/')) {
      const username = url.pathname.split('/').pop();
      if (!/^[a-z][a-z0-9.-]{2,15}$/.test(username)) { res.writeHead(400); res.end(JSON.stringify({error:'Enter a valid Hive username.'})); return; }
      let entry = cache.get(username);
      if (!entry || Date.now()-entry.time > 60000) {
        const response = await fetch(`https://api.splinterlands.com/cards/collection/${username}`, {signal:AbortSignal.timeout(15000)});
        if (!response.ok) throw new Error('Collection service is unavailable. Try again shortly.');
        const data = await response.json();
        if (!Array.isArray(data.cards) || !data.cards.length) throw new Error('No native Hive cards found for this account.');
        entry = {time:Date.now(),data}; cache.set(username,entry);
        if (cache.size>100) cache.delete(cache.keys().next().value);
      }
      res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify(entry.data)); return;
    }
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    const relative = path.relative(root,file);
    if (relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(x=>x.startsWith('.')) || !['index.html','style.css','app.js','engine.js','run.js','roster.js','data.js','data','assets'].includes(relative.split(path.sep)[0])) { res.writeHead(403);res.end('Forbidden');return; }
    const content = await readFile(file);
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':'no-cache'}); res.end(content);
  } catch (error) { res.writeHead(req.url.startsWith('/api/')?502:404,{'Content-Type':'application/json'});res.end(JSON.stringify({error:req.url.startsWith('/api/')?error.message:'Not found'})); }
});
server.listen(Number(process.env.PORT)||4173,'127.0.0.1',()=>console.log(`Rift Walker is ready at http://localhost:${server.address().port}`));
