/**
 * Durable Object: SessionRoom
 * Used for real-time collaboration or presence tracking in the ITSM platform.
 * Example: track active users viewing a ticket or asset in real time.
 *
 * Deployment: Add to wrangler.toml under [durable_objects.bindings]
 */

export class SessionRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Map();
  }

  async fetch(request) {
    const url = new URL(request.url);

    // WebSocket upgrade for real-time session
    if (url.pathname === '/connect') {
      const pair = new WebSocketPair();
      this.state.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }

    // HTTP endpoint: get session info
    if (url.pathname === '/info') {
      const info = {
        roomId: this.state.id.toString(),
        activeSessions: this.sessions.size,
        timestamp: new Date().toISOString()
      };
      return new Response(JSON.stringify(info), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }

  // Handle WebSocket messages
  webSocketMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      this.sessions.set(ws, data);
      // Broadcast to all connected clients
      const clients = this.state.getWebSockets();
      for (const client of clients) {
        client.send(JSON.stringify({ type: 'presence', data }));
      }
    } catch (e) {
      console.error('SessionRoom message error:', e);
    }
  }

  webSocketClose(ws, code, reason, wasClean) {
    this.sessions.delete(ws);
  }
}
