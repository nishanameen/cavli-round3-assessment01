import { mkdir, writeFile } from 'node:fs/promises';

const base = process.env.CAVLI_URL?.replace(/\/$/, '');
if (!base || !process.env.DEMO_ACCESS_SECRET) throw Error('Hosted URL and reviewer secret are required.');
const request = (path, body, authenticate = true) => fetch(base + path, {
  method: body ? 'POST' : 'GET',
  headers: {
    ...(authenticate ? { Authorization: 'Basic ' + Buffer.from('reviewer:' + process.env.DEMO_ACCESS_SECRET).toString('base64') } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  },
  body: body ? JSON.stringify(body) : undefined,
  signal: AbortSignal.timeout(40000),
});
const checks = [];
const mark = (name, passed, evidence = {}) => checks.push({ name, passed, ...evidence });
try {
  const anonymous = await request('/', undefined, false);
  mark('Reviewer gate', anonymous.status === 401, { status: anonymous.status });
  const ui = await request('/');
  mark('Hosted chat UI', ui.ok && (await ui.text()).includes('Cavli Module Assistant'), { status: ui.status });
  const health = await request('/api/health');
  const settings = health.ok ? await health.json() : {};
  mark('Provider bindings', health.ok && settings.catalog === true && settings.generation === true, { status: health.status });
  const tests = [
    ['What are the C16QS peak download and upload speeds?', row => row.answer?.includes('10 Mbps') && row.answer?.includes('5 Mbps') && row.citations?.some(s => s.id === 'c16qs-speed')],
    ['Which LTE bands does the C16QS India variant support?', row => /1, 3, 5, 8, 40, and 41/.test(row.answer) && row.citations?.some(s => s.id === 'c16qs-bands')],
    ['Does every C16QS variant have eSIM?', row => /GNAH/.test(row.answer) && /GNAN/.test(row.answer) && row.citations?.some(s => s.id === 'c16qs-esim')],
    ['Which module should I shortlist for at least 20 Mbps published peak downlink?', row => row.status === 'recommendation' && /Shortlist C20QM/.test(row.answer) && row.citations?.length === 2],
    ['Will the C16QS work with my custom antenna and carrier configuration?', row => row.status === 'unsupported' && /not verified/i.test(row.answer) && row.helpLinks?.length > 0],
  ];
  let sawProviders = false;
  let feedbackToken;
  for (const [question, expected] of tests) {
    const response = await request('/api/chat', { question });
    const row = response.ok ? await response.json() : {};
    mark(question, response.ok && expected(row), {
      status: response.status, answer: row.answer, citations: row.citations, helpLinks: row.helpLinks,
      timing: row.timing, retrieval: row.retrieval, generation: row.generation, degraded: row.degraded,
    });
    if (row.generation === 'Gemini evidence selection' && row.retrieval === 'pgvector + exact matches' &&
        row.status === 'answered' && !row.degraded && expected(row)) {
      sawProviders = true;
      feedbackToken ||= row.token;
    }
  }
  mark('Live Supabase and Gemini answer', sawProviders);
  if (feedbackToken) {
    const feedback = await request('/api/feedback', { token: feedbackToken, rating: 'helpful', reason: null });
    mark('Hosted feedback request', feedback.ok, { status: feedback.status });
  }
} catch (error) {
  mark('Hosted smoke runner', false, { error: error.name, code: error.cause?.code ?? null });
}
await mkdir('outputs', { recursive: true });
await writeFile('outputs/hosted-verification.json', JSON.stringify({ base, checkedAt: new Date().toISOString(), checks }, null, 2) + '\n');
for (const check of checks) console.log((check.passed ? 'PASS ' : 'FAIL ') + check.name);
if (!checks.length || checks.some(check => !check.passed)) process.exitCode = 1;
