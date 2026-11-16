import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import app from '../dist/worker.mjs';

const assets = new Map([['/', ['index.html','text/html']],['/styles.css',['styles.css','text/css']],['/app.js',['app.js','text/javascript']],['/cavli-logo.svg',['cavli-logo.svg','image/svg+xml']],['/login.css',['login.css','text/css']],
  ...['400','500','600'].map(w=>['/fonts/space-grotesk-latin-'+w+'-normal.woff2',['fonts/space-grotesk-latin-'+w+'-normal.woff2','font/woff2']])]);
const env = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  CATALOG_TOKEN: process.env.CATALOG_TOKEN,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
  DEMO_ACCESS_SECRET: process.env.DEMO_ACCESS_SECRET,
  async PREVIEW_FEEDBACK(details) {
    const folder = resolve('outputs/private/feedback');
    await mkdir(folder,{recursive:true});
    await writeFile(resolve(folder,details.answer_id+'.json'),JSON.stringify({...details,created_at:new Date()},null,2),{flag:'wx'});
  },
  ASSETS: { async fetch(request) {
    const asset = assets.get(new URL(request.url).pathname);
    return asset ? new Response(await readFile(resolve('dist/web', asset[0])), {headers:{'Content-Type':asset[1]}})
      : new Response('Not found', {status:404});
  }},
};
const port = Number(process.env.PORT || 8789);
createServer(async (incoming, outgoing) => {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of incoming) {
      size += chunk.length;
      if (size > 8000) { outgoing.writeHead(413).end(); return; }
      chunks.push(chunk);
    }
    const method = incoming.method || 'GET';
    const request = new Request(new URL(incoming.url || '/', 'http://127.0.0.1:' + port), {
      method, headers: incoming.headers, body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks),
    });
    const response = await app.fetch(request, env);
    outgoing.writeHead(response.status,Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(500).end('Preview request failed'); }
}).listen(port, '127.0.0.1', () => console.log('Cavli preview: http://127.0.0.1:' + port));
