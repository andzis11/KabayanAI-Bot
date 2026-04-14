import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

interface PnLData {
  tokenName: string;
  tokenMint: string;
  entryPrice: number;
  exitPrice: number;
  pnlPercent: number;
  pnlSol: number;
  holdingTime: string;
}

export async function generatePnLCard(data: PnLData): Promise<Buffer | null> {
  try {
    const isProfit = data.pnlSol >= 0;
    const imgPath = path.join(process.cwd(), 'src', 'assets', isProfit ? 'profit.png' : 'loss.png');

    if (!fs.existsSync(imgPath)) return null;

    const meta = await sharp(imgPath).metadata();
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

    return sharp(imgPath)
      .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
      .png()
      .toBuffer();
  } catch (e: any) {
    logger.error(`[PNL] Error: ${e.message}`);
    return null;
  }
}

