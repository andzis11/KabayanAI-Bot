"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startAlphaMonitor = startAlphaMonitor;
const web3_js_1 = require("@solana/web3.js");
const alphaWallet_1 = require("../ai/alphaWallet");
const logger_1 = require("../utils/logger");
function startAlphaMonitor(connection, onSignal) {
    const interval = setInterval(async function () {
        const wallets = (0, alphaWallet_1.getAlphaWallets)();
        if (wallets.length === 0)
            return;
        for (let wi = 0; wi < wallets.length; wi++) {
            const wallet = wallets[wi];
            try {
                const pubkey = new web3_js_1.PublicKey(wallet);
                const sigs = await connection.getSignaturesForAddress(pubkey, { limit: 3 });
                for (let si = 0; si < sigs.length; si++) {
                    const sig = sigs[si];
                    if (!sig.signature)
                        continue;
                    try {
                        const tx = await connection.getTransaction(sig.signature, {
                            maxSupportedTransactionVersion: 0,
                            commitment: 'confirmed',
                        });
                        if (!tx || !tx.meta)
                            continue;
                        const preBalances = tx.meta.preBalances || [];
                        const postBalances = tx.meta.postBalances || [];
                        const postTokenBalances = tx.meta.postTokenBalances || [];
                        const preTokenBalances = tx.meta.preTokenBalances || [];
                        let solChange = 0;
                        for (let bi = 0; bi < preBalances.length; bi++) {
                            const change = (preBalances[bi] - postBalances[bi]) / 1e9;
                            if (Math.abs(change) > 0.01) {
                                solChange = change;
                            }
                        }
                        for (let pi = 0; pi < postTokenBalances.length; pi++) {
                            const ptb = postTokenBalances[pi];
                            if (ptb.owner !== wallet)
                                continue;
                            const mint = ptb.mint;
                            const postAmt = parseFloat(ptb.uiTokenAmount?.uiAmountString || '0');
                            let preAmt = 0;
                            for (let ri = 0; ri < preTokenBalances.length; ri++) {
                                const prb = preTokenBalances[ri];
                                if (prb.owner === wallet && prb.mint === mint) {
                                    preAmt = parseFloat(prb.uiTokenAmount?.uiAmountString || '0');
                                }
                            }
                            const tokenChange = postAmt - preAmt;
                            if (Math.abs(tokenChange) > 0 && mint !== 'So11111111111111111111111111111111111111112') {
                                const amountSol = Math.abs(solChange);
                                if (amountSol >= 0.1) {
                                    const event = {
                                        wallet: wallet,
                                        tokenMint: mint,
                                        amountSol: amountSol,
                                        timestamp: Date.now(),
                                        type: tokenChange > 0 ? 'BUY' : 'SELL',
                                    };
                                    logger_1.logger.info('[ALPHA] ' + event.type + ' ' + mint.slice(0, 8) + '... ' + amountSol.toFixed(2) + ' SOL from ' + wallet.slice(0, 8) + '...');
                                    if (event.type === 'BUY') {
                                        await onSignal(event);
                                    }
                                }
                            }
                        }
                    }
                    catch (innerErr) {
                        // skip individual tx errors
                    }
                }
            }
            catch (err) {
                logger_1.logger.warn('[ALPHA] Monitor error for ' + wallet.slice(0, 8) + ': ' + err.message);
            }
        }
    }, 15000);
    return interval;
}
//# sourceMappingURL=alphaMonitor.js.map