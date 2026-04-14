"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAlphaWalletsFromDB = loadAlphaWalletsFromDB;
exports.addAlphaWallet = addAlphaWallet;
exports.removeAlphaWallet = removeAlphaWallet;
exports.getAlphaWallets = getAlphaWallets;
exports.getAlphaWalletCount = getAlphaWalletCount;
exports.evaluateAlphaSignal = evaluateAlphaSignal;
const logger_1 = require("../utils/logger");
const securityGate_1 = require("./securityGate");
const db_1 = require("../database/db");
// In-memory cache untuk kecepatan lookup
const TRACKED = new Set();
let initialized = false;
function ensureTable() {
    const db = (0, db_1.getDb)();
    db.exec(`
    CREATE TABLE IF NOT EXISTS alpha_wallets (
      address TEXT PRIMARY KEY,
      label TEXT,
      added_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alpha_wallets_address ON alpha_wallets(address);
  `);
}
function loadAlphaWalletsFromDB() {
    if (initialized)
        return;
    try {
        ensureTable();
        const db = (0, db_1.getDb)();
        const rows = db.prepare('SELECT address FROM alpha_wallets').all();
        rows.forEach(r => TRACKED.add(r.address));
        initialized = true;
        logger_1.logger.info('[ALPHA] Loaded ' + rows.length + ' wallets from DB');
    }
    catch (e) {
        logger_1.logger.warn('[ALPHA] Failed to load from DB: ' + e.message);
        initialized = true;
    }
}
function addAlphaWallet(address, label) {
    loadAlphaWalletsFromDB();
    try {
        ensureTable();
        const db = (0, db_1.getDb)();
        db.prepare('INSERT OR IGNORE INTO alpha_wallets(address, label, added_at) VALUES(?, ?, ?)').run(address, label || null, Date.now());
        TRACKED.add(address);
        logger_1.logger.info('[ALPHA] Added: ' + address.slice(0, 8) + '...' + (label ? ' (' + label + ')' : ''));
    }
    catch (e) {
        logger_1.logger.warn('[ALPHA] DB insert failed: ' + e.message);
        TRACKED.add(address); // tetap tambah ke memory
    }
}
function removeAlphaWallet(address) {
    loadAlphaWalletsFromDB();
    try {
        const db = (0, db_1.getDb)();
        db.prepare('DELETE FROM alpha_wallets WHERE address = ?').run(address);
        TRACKED.delete(address);
        logger_1.logger.info('[ALPHA] Removed: ' + address.slice(0, 8) + '...');
    }
    catch (e) {
        logger_1.logger.warn('[ALPHA] DB delete failed: ' + e.message);
        TRACKED.delete(address);
    }
}
function getAlphaWallets() {
    loadAlphaWalletsFromDB();
    return Array.from(TRACKED);
}
function getAlphaWalletCount() {
    loadAlphaWalletsFromDB();
    return TRACKED.size;
}
async function evaluateAlphaSignal(conn, event, config) {
    loadAlphaWalletsFromDB();
    if (!TRACKED.has(event.wallet))
        return { shouldBuy: false, reason: 'NOT_TRACKED' };
    if (event.amountSol < config.alphaMinSol)
        return { shouldBuy: false, reason: `LOW_AMOUNT_${event.amountSol}` };
    const age = (event.timestamp - event.pairCreatedAt) / 1000;
    if (age > config.alphaMaxAgeSeconds)
        return { shouldBuy: false, reason: `OLD_PAIR_${age}s` };
    const gate = await (0, securityGate_1.runSecurityGate)(conn, event.tokenMint, null);
    if (!gate.passed)
        return { shouldBuy: false, reason: `GATE_FAIL_${gate.failedReason}` };
    return { shouldBuy: true, reason: 'ALPHA_PASS' };
}
//# sourceMappingURL=alphaWallet.js.map