// Local-only static release host. API traffic is never forwarded to production.
// Browser scenarios intercept /api-proxy; the exact Worker is tested separately.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.env.QA_STATIC_DIR || '.next-qa-fixed');
const port = Number(process.env.QA_STATIC_PORT || 4173);
const types = {'.html':'text/html; charset=utf-8','.js':'application/javascript','.css':'text/css','.json':'application/json','.txt':'text/plain','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
const server = createServer(async (req, res) => {
 const url=new URL(req.url,'http://localhost');
 if(url.pathname.startsWith('/api-proxy/')){res.writeHead(401,{'Content-Type':'application/json'});res.end(JSON.stringify({message:'Synthetic API required'}));return;}
 try {
  let file=path.resolve(root,`.${decodeURIComponent(url.pathname)}`);
  if(file!==root && !file.startsWith(`${root}${path.sep}`))throw new Error('Invalid path');
  if((await stat(file)).isDirectory())file=path.join(file,'index.html');
  const content=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log(`QA static release: http://127.0.0.1:${port}; no production API forwarding`));
