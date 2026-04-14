"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startHealthServer = startHealthServer;
exports.stopHealthServer = stopHealthServer;
const http_1 = __importDefault(require("http"));
const logger_1 = require("./logger");
let server = null;
function startHealthServer(port = 3000) {
    server = http_1.default.createServer((req, res) => {
        if (req.url === '/health') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
        }
        else {
            res.writeHead(404);
            res.end();
        }
    });
    server.listen(port, '127.0.0.1', () => {
        logger_1.logger.info(`[HEALTH] Server running on port ${port}`);
    });
}
function stopHealthServer() {
    if (server) {
        server.close();
        server = null;
    }
}
//# sourceMappingURL=healthServer.js.map