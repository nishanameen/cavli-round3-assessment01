import { mkdir, writeFile } from 'node:fs/promises';
import app from '../dist/worker.mjs';

const base = process.env.CAVLI_URL;
const authorization = process.env.DEMO_ACCESS_SECRET
  ? 'Basic ' + Buffer.from('reviewer:' + process.env.DEMO_ACCESS_SECRET).toString('base64')
  : undefined;
const send = (request) => base ? fetch(request) : app.fetch(request, {
  SUPABASE_URL: process.env.SUPABASE_URL,
  CATALOG_TOKEN: process.env.CATALOG_TOKEN,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: process.env.GEMINI_MODEL,
});
const questions = [
  'What are the C16QS peak download and upload speeds?',
  'Which LTE bands does the C16QS India variant support?',
  'Does every C16QS variant have eSIM?',
  'Which module should I shortlist for at least 20 Mbps published peak downlink?',
  'Will the C16QS work with my custom antenna and carrier configuration?',
];
const requirements = [
  row => /10 Mbps.*5 Mbps/.test(row.answer) && row.citations.some(s=>s.id==='c16qs-speed'),
  row => /1, 3, 5, 8, 40, and 41/.test(row.answer) && row.citations.some(s=>s.id==='c16qs-bands'),
  row => /GNAH/.test(row.answer) && /GNAN/.test(row.answer) && row.citations.some(s=>s.id==='c16qs-esim'),
  row => row.status==='recommendation' && /Shortlist C20QM/.test(row.answer) && row.citations.length===2,
  row => row.status==='unsupported' && /not verified/i.test(row.answer) && row.helpLinks.length>0,
];
const outputs = [];
for (const [i, question] of questions.entries()) {
  const response = await send(new Request((base || 'https://preview.invalid') + '/api/chat', {
    method:'POST',headers:{'Content-Type':'application/json', ...(base && authorization ? {Authorization:authorization} : {})},body:JSON.stringify({question}),
  }));
  if (!response.ok) throw Error('Request failed for sample ' + (i+1));
  const { token, ...row } = await response.json();
  outputs.push({ question, passed: requirements[i](row), ...row });
}
await mkdir('outputs',{recursive:true});
await writeFile('outputs/sample-outputs.json',JSON.stringify({captured_at:new Date(),mode:base?'Hosted HTTP':'In-process Worker',base,outputs},null,2)+'\n');
console.log(outputs.map(row=>[row.passed?'PASS':'FAIL',row.status,row.timing.total_ms+' ms',row.question].join(' · ')).join('\n'));
if (outputs.some(row=>!row.passed)) process.exitCode=1;
