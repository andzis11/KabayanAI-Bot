import http from 'http';
import { logger } from './logger';

let server: http.Server | null = null;

export function startHealthServer(port = 3000) {
  server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  server.listen(port, '127.0.0.1', () => {
    logger.info(`[HEALTH] Server running on port ${port}`);
  });
}

export function stopHealthServer() {
  if (server) {
    server.close();
    server = null;
  }
}
