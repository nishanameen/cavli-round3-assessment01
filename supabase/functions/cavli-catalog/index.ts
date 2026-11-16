declare namespace Supabase {
  namespace ai {
    class Session {
      constructor(model: string);
      run(text: string, options: {mean_pool: boolean; normalize: boolean}): Promise<number[]>;
    }
  }
}

const model = new Supabase.ai.Session('gte-small');
const base = Deno.env.get('SUPABASE_URL');
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const headers = { 'Content-Type': 'application/json', apikey: key ?? '', Authorization: 'Bearer ' + (key ?? '') };
const reply = (data: unknown, status = 200) => Response.json(data, { status });
async function db(path: string, body?: unknown, method = body ? 'POST' : 'GET') {
  const resp = await fetch(base + '/rest/v1/' + path, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) throw new Error('Database request failed');
  return (await resp.text()) || 'null';
}
async function embed(text: string) {
  const result = await model.run(text, { mean_pool: true, normalize: true });
  if (!Array.isArray(result) || result.length !== 384 || !result.every(Number.isFinite)) {
    throw new Error('Embedding unavailable');
  }
  return JSON.stringify(result);
}
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return reply({ error: 'Use POST.' }, 405);
  if (!base || !key) return reply({ error: 'Service configuration unavailable.' }, 503);
  try {
    const auth = req.headers.get('Authorization') ?? '';
    if (!/^Bearer [0-9a-f]{64}$/.test(auth)) return reply({ error: 'Unauthorized.' }, 401);
    const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(auth.slice(7))));
    const hash = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    const [access] = JSON.parse(await db('cavli_runtime_keys?select=can_seed,expires_at&token_hash=eq.' + hash));
    if (!access || (access.expires_at && Date.parse(access.expires_at) <= Date.now())) {
      return reply({ error: 'Unauthorized.' }, 401);
    }
    const raw = await req.text();
    if (raw.length > 4000) return reply({ error: 'Request too large.' }, 413);
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(raw);
      if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error();
    } catch { return reply({ error: 'Invalid request.' }, 400); }
    if (data.action === 'seed' && access.can_seed) {
      const rows = JSON.parse(await db('product_evidence?select=id,section,body&embedding=is.null&order=id&limit=3'));
      await Promise.all(rows.map(async (row: {id: string; section: string; body: string}) => {
        const embedding = await embed(row.section + ': ' + row.body);
        await db('product_evidence?id=eq.' + encodeURIComponent(row.id), { embedding, embedding_model: 'gte-small' }, 'PATCH');
      }));
      return reply({ embedded: rows.length });
    }
    if (data.action === 'feedback') {
      const { answer_id, rating, reason, status, evidence_ids } = data;
      if (typeof answer_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(answer_id) ||
          !['helpful','needs_review'].includes(String(rating)) ||
          !(reason === null || ['incorrect_spec','wrong_variant','weak_citation','other'].includes(String(reason))) ||
          !['answered','recommendation','unsupported','clarify'].includes(String(status)) ||
          !Array.isArray(evidence_ids) || evidence_ids.length > 10 ||
          evidence_ids.some((entry) => typeof entry !== 'string' || !/^[a-z0-9-]{1,40}$/.test(entry))) {
        return reply({ error: 'Invalid feedback.' }, 400);
      }
      await db('chat_feedback?on_conflict=answer_id', { answer_id, rating, reason, status, evidence_ids });
      return reply({ ok: true });
    }
    if (data.action === 'modules') {
      return reply({ specs: JSON.parse(await db('product_modules?select=id,technology,peak_downlink_mbps,peak_uplink_mbps,source_url,evidence_id&order=id')) });
    }
    if (data.action !== 'search' || typeof data.query !== 'string' || !data.query.trim() || data.query.length > 800 ||
        !(data.module == null || data.module === 'C16QS' || data.module === 'C20QM')) {
      return reply({ error: 'Invalid search.' }, 400);
    }
    const query_embedding = await embed(data.query);
    const rows = JSON.parse(await db('rpc/match_product_evidence',
      { query_embedding, filter_module: data.module ?? null, match_count: 6 }));
    return reply({ rows });
  } catch {
    return reply({ error: 'Catalog service is temporarily unavailable.' }, 503);
  }
});
