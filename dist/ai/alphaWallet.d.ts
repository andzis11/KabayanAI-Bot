import { Connection } from '@solana/web3.js';
import { AlphaWalletEvent, AIAgentConfig } from './types';
export declare function loadAlphaWalletsFromDB(): void;
export declare function addAlphaWallet(address: string, label?: string): void;
export declare function removeAlphaWallet(address: string): void;
export declare function getAlphaWallets(): string[];
export declare function getAlphaWalletCount(): number;
export declare function evaluateAlphaSignal(conn: Connection, event: AlphaWalletEvent, config: AIAgentConfig): Promise<{
    shouldBuy: boolean;
    reason: string;
}>;
