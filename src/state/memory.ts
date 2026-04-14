import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

const MEMORY_PATH = path.join(process.cwd(), 'ai_memory.json');

interface MemoryEntry { key: string; value: any; timestamp: number; }

let memoryCache: Map<string, MemoryEntry> = new Map();

export function loadMemory(): void {
  try {
    if (fs.existsSync(MEMORY_PATH)) {
      const entries: MemoryEntry[] = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf-8'));
      for (const e of entries) memoryCache.set(e.key, e);
      logger.info(`[MEMORY] Loaded ${memoryCache.size} entries`);
    }
  } catch (error: any) {
    logger.error(`[MEMORY] Load error: ${error.message}`);
  }
}

function saveMemory(): void {
  try {
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(Array.from(memoryCache.values()), null, 2));
  } catch (error: any) {
    logger.error(`[MEMORY] Save error: ${error.message}`);
  }
}

export function setMemory(key: string, value: any): void {
  memoryCache.set(key, { key, value, timestamp: Date.now() });
  saveMemory();
}

export function getMemory(key: string): any {
  return memoryCache.get(key)?.value || null;
}

export function deleteMemory(key: string): void {
  memoryCache.delete(key);
  saveMemory();
}

