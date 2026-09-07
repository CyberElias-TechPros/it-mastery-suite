export default {
  async handle(path, method, request, env, ctx) {
    const id = path.split('/').pop();
    // GET /tickets or /tickets?status=open
    if (method === 'GET' && (!id || path === '/')) {
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const limit = url.searchParams.get('limit') || '10';
      let query = 'SELECT * FROM tickets';
      if (status) query += ' WHERE status = ?';
      query += ' ORDER BY created_at DESC LIMIT ?';
      const stmt = env.DB.prepare(query);
      const result = status ? await stmt.bind(status, parseInt(limit)).all() : await stmt.bind(parseInt(limit)).all();
      return new Response(JSON.stringify({ tickets: result.results || result, pagination: { limit: parseInt(limit), total: (result.results || result).length } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    // GET /tickets/:id
    if (method === 'GET' && id) {
      const stmt = env.DB.prepare('SELECT * FROM tickets WHERE id = ?');
      const result = await stmt.bind(id).first();
      return new Response(JSON.stringify({ ticket: result || { error: 'Not found' } }), { status: result ? 200 : 404, headers: { 'Content-Type': 'application/json' } });
    }
    // POST /tickets
    if (method === 'POST' && (!id || path === '/')) {
      const body = await request.json();
      const { title, description, category = 'other', priority = 'medium', created_by = 'system' } = body;
      const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
      const ticketNumber = 'TKT-' + id.slice(-6);
      await env.DB.prepare('INSERT INTO tickets (id, ticket_number, title, description, category, priority, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .bind(id, ticketNumber, title, description, category, priority, 'open', created_by).run();
      return new Response(JSON.stringify({ message: 'Ticket created', ticket: { id, ticket_number: ticketNumber } }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ error: 'Ticket route not handled', path, method }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  }
};
