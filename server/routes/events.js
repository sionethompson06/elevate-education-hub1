import { Router } from 'express';
import { verifyToken } from '../middleware/auth.js';
import { addSSEClient, removeSSEClient } from '../services/sse.service.js';

const router = Router();

// EventSource can't send custom headers, so the JWT is passed as ?token=<jwt>.
function requireSSEAuth(req, res, next) {
  const token = req.query.token;
  if (!token) return res.status(401).end();
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).end();
  }
}

router.get('/', requireSSEAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write('event: connected\ndata: {}\n\n');
  addSSEClient(res);

  // Keep-alive ping every 25 s to survive proxy idle timeouts
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    removeSSEClient(res);
  });
});

export default router;
