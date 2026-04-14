"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPrelaunchCheck = runPrelaunchCheck;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger_1 = require("./logger");
async function runPrelaunchCheck() {
    const results = [];
    results.push({
        name: '.env file',
        passed: fs_1.default.existsSync(path_1.default.join(process.cwd(), '.env')),
        message: fs_1.default.existsSync(path_1.default.join(process.cwd(), '.env')) ? 'Found' : 'Missing — run setup.sh',
    });
    const dataDir = path_1.default.join(process.cwd(), 'data');
    if (!fs_1.default.existsSync(dataDir))
        fs_1.default.mkdirSync(dataDir, { recursive: true });
    results.push({ name: 'data/ directory', passed: true, message: 'Ready' });
    const logsDir = path_1.default.join(process.cwd(), 'logs');
    if (!fs_1.default.existsSync(logsDir))
        fs_1.default.mkdirSync(logsDir, { recursive: true });
    results.push({ name: 'logs/ directory', passed: true, message: 'Ready' });
    const assetsDir = path_1.default.join(process.cwd(), 'src', 'assets');
    if (!fs_1.default.existsSync(assetsDir))
        fs_1.default.mkdirSync(assetsDir, { recursive: true });
    results.push({ name: 'src/assets/ directory', passed: true, message: 'Ready' });
    logger_1.logger.info('=== Pre-launch Check ===');
    let allPassed = true;
    for (const r of results) {
        const icon = r.passed ? '✅' : '❌';
        logger_1.logger.info(`${icon} ${r.name}: ${r.message}`);
        if (!r.passed)
            allPassed = false;
    }
    logger_1.logger.info('========================');
    return allPassed;
}
//# sourceMappingURL=prelaunchCheck.js.map