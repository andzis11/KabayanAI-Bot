"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkHealth = checkHealth;
const wallet_1 = require("../config/wallet");
const db_1 = require("../database/db");
const logger_1 = require("./logger");
async function checkHealth() {
    const status = {
        solanaRpc: false,
        database: false,
        memoryMb: 0,
        uptime: '',
    };
    try {
        await wallet_1.connection.getSlot();
        status.solanaRpc = true;
    }
    catch {
        logger_1.logger.error('[HEALTH] Solana RPC unreachable');
    }
    try {
        const db = (0, db_1.getDb)();
        db.prepare('SELECT 1').get();
        status.database = true;
    }
    catch {
        logger_1.logger.error('[HEALTH] Database unreachable');
    }
    const mem = process.memoryUsage();
    status.memoryMb = Math.round(mem.heapUsed / 1024 / 1024);
    const up = Math.round(process.uptime());
    const hours = Math.floor(up / 3600);
    const mins = Math.floor((up % 3600) / 60);
    status.uptime = `${hours}h ${mins}m`;
    return status;
}
//# sourceMappingURL=healthCheck.js.map