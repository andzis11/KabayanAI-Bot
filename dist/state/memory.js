"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadMemory = loadMemory;
exports.setMemory = setMemory;
exports.getMemory = getMemory;
exports.deleteMemory = deleteMemory;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("../utils/logger");
const MEMORY_PATH = path_1.default.join(process.cwd(), 'ai_memory.json');
let memoryCache = new Map();
function loadMemory() {
    try {
        if (fs_1.default.existsSync(MEMORY_PATH)) {
            const entries = JSON.parse(fs_1.default.readFileSync(MEMORY_PATH, 'utf-8'));
            for (const e of entries)
                memoryCache.set(e.key, e);
            logger_1.logger.info(`[MEMORY] Loaded ${memoryCache.size} entries`);
        }
    }
    catch (error) {
        logger_1.logger.error(`[MEMORY] Load error: ${error.message}`);
    }
}
function saveMemory() {
    try {
        fs_1.default.writeFileSync(MEMORY_PATH, JSON.stringify(Array.from(memoryCache.values()), null, 2));
    }
    catch (error) {
        logger_1.logger.error(`[MEMORY] Save error: ${error.message}`);
    }
}
function setMemory(key, value) {
    memoryCache.set(key, { key, value, timestamp: Date.now() });
    saveMemory();
}
function getMemory(key) {
    return memoryCache.get(key)?.value || null;
}
function deleteMemory(key) {
    memoryCache.delete(key);
    saveMemory();
}
//# sourceMappingURL=memory.js.map