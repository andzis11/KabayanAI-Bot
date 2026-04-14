import { Connection } from "@solana/web3.js";
export interface SecurityCheck {
    passed: boolean;
    reason: string;
    score: number;
    failedReason: string;
    checks: {
        mint_authority_disabled: boolean;
        freeze_authority_disabled: boolean;
        honeypot_ok: boolean;
        top10_holders_ok: boolean;
        bundled_supply_ok: boolean;
        pool_liquidity_ok: boolean;
        volume_to_mcap_ok: boolean;
        dev_wallet_clean: boolean;
    };
}
export declare function runSecurityGate(connection: Connection | null, mint: string, devWallet: string | null): Promise<SecurityCheck>;
export declare function quickSecurityCheck(hasFreeze: boolean, hasMint: boolean, liquidityLocked: boolean): boolean;
export declare function addToBlacklist(wallet: string): void;
