import { Connection, Keypair, PublicKey } from '@solana/web3.js';
export declare const connection: Connection;
export declare const wallet: Keypair;
export declare const walletPubkey: PublicKey;
export declare function getBalance(): Promise<number>;
export declare function getWalletAddress(): Promise<string>;
