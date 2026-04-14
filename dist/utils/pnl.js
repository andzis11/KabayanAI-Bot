"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePnLCard = generatePnLCard;
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = require("./logger");
async function generatePnLCard(data) {
    try {
        const isProfit = data.pnlSol >= 0;
        const imgPath = path_1.default.join(process.cwd(), 'src', 'assets', isProfit ? 'profit.png' : 'loss.png');
        if (!fs_1.default.existsSync(imgPath))
            return null;
        const meta = await (0, sharp_1.default)(imgPath).metadata();
        const svg = `<svg width="${meta.width}" height="${meta.height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .t{font-family:monospace;font-size:28px;fill:white;font-weight:bold}
        .p{font-family:monospace;font-size:48px;fill:${isProfit ? '#00ff88' : '#ff4444'};font-weight:bold}
        .d{font-family:monospace;font-size:18px;fill:#ccc}
      </style>
      <text x="50%" y="180" text-anchor="middle" class="t">${data.tokenName}</text>
      <text x="50%" y="260" text-anchor="middle" class="p">${isProfit ? '+' : ''}${data.pnlPercent.toFixed(1)}%</text>
      <text x="50%" y="310" text-anchor="middle" class="d">${isProfit ? '+' : ''}${data.pnlSol.toFixed(4)} SOL</text>
      <text x="50%" y="350" text-anchor="middle" class="d">${data.holdingTime}</text>
    </svg>`;
        return (0, sharp_1.default)(imgPath)
            .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
            .png()
            .toBuffer();
    }
    catch (e) {
        logger_1.logger.error(`[PNL] Error: ${e.message}`);
        return null;
    }
}
//# sourceMappingURL=pnl.js.map