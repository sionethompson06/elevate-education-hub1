const clients = new Set();

export function addSSEClient(res) {
  clients.add(res);
}

export function removeSSEClient(res) {
  clients.delete(res);
}

export function broadcastEvent(event, data = {}) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of [...clients]) {
    try {
      res.write(msg);
    } catch {
      clients.delete(res);
    }
  }
}
