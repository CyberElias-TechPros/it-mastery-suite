export default {
  async handle(path, method, request, env, ctx) {
    const id = path.split('/').pop();
    // GET /assets or /assets?status=active&type=laptop
    if (method === 'GET' && (!id || path === '/')) {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const limit = url.searchParams.get('limit') || '10';
      let query = 'SELECT * FROM assets';
      const params = [];
      if (status) { query += ' WHERE status = ?'; params.push(status); }
      query += ' ORDER BY created_at DESC LIMIT ?'; params.push(parseInt(limit));
      const stmt = env.DB.prepare(query);
      const result = await stmt.bind(...params).all();
      return new Response(JSON.stringify({ assets: result.results || result, pagination: { limit: parseInt(limit), total: (result.results || result).length } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // POST /assets
    if (method === 'POST' && (!id || path === '/')) {
      const body = await request.json();
      const { assetTag, name, type = 'other', model, status = 'active' } = body;
      const idGen = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      await env.DB.prepare('INSERT INTO assets (id, asset_tag, name, type, model, status) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(idGen, assetTag, name, type, model || '', status).run();
      return new Response(JSON.stringify({ message: 'Asset created', asset: { id: idGen, asset_tag: assetTag, name } }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'Asset route not handled', path, method }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }
};
