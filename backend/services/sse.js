// Simple Server-Sent Events (SSE) manager for tenant notifications
const clients = new Map(); // tenantId => Set of res objects

const subscribe = (tenantId, res) => {
  if (!clients.has(tenantId)) clients.set(tenantId, new Set());
  clients.get(tenantId).add(res);

  // Send initial connected event
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'connected' })}\n\n`);

  // heartbeat every 20s to keep connection alive
  const keepAlive = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch (e) {
      // ignore
    }
  }, 20000);

  // cleanup on client close
  reqOnClose(res, () => {
    clearInterval(keepAlive);
    const set = clients.get(tenantId);
    if (set) {
      set.delete(res);
      if (set.size === 0) clients.delete(tenantId);
    }
  });
};

const reqOnClose = (res, cb) => {
  res.on('close', cb);
  res.on('finish', cb);
};

const sendEventToTenant = (tenantId, eventName, data) => {
  const set = clients.get(tenantId);
  if (!set) return false;
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  set.forEach(res => {
    try {
      res.write(payload);
    } catch (e) {
      // ignore write errors
    }
  });
  return true;
};

module.exports = { subscribe, sendEventToTenant };
