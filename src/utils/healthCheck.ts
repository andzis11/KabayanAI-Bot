import { connection } from '../config/wallet';
import { getDb } from '../database/db';
import { logger } from './logger';

interface HealthStatus {
  solanaRpc: boolean;
  database: boolean;
  memoryMb: number;
  uptime: string;
}

export async function checkHealth(): Promise<HealthStatus> {
  const status: HealthStatus = {
    solanaRpc: false,
    database: false,
    memoryMb: 0,
    uptime: '',
  };

  try {
    await connection.getSlot();
    status.solanaRpc = true;
  } catch {
    logger.error('[HEALTH] Solana RPC unreachable');
  }

  try {
    const db = getDb();
    db.prepare('SELECT 1').get();
    status.database = true;
  } catch {
    logger.error('[HEALTH] Database unreachable');
  }

  const mem = process.memoryUsage();
  status.memoryMb = Math.round(mem.heapUsed / 1024 / 1024);

  const up = Math.round(process.uptime());
  const hours = Math.floor(up / 3600);
  const mins = Math.floor((up % 3600) / 60);
  status.uptime = `${hours}h ${mins}m`;

  return status;
}

