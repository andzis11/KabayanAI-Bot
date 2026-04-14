import { Connection, PublicKey } from '@solana/web3.js';
import { getAlphaWallets } from '../ai/alphaWallet';
import { logger } from '../utils/logger';

export interface AlphaEvent {
  wallet: string;
  tokenMint: string;
  amountSol: number;
  timestamp: number;
  type: string;
}

export function startAlphaMonitor(
  connection: Connection,
  onSignal: (event: AlphaEvent) => Promise<void>
): ReturnType<typeof setInterval> {
  const interval = setInterval(async function() {
    const wallets = getAlphaWallets();
    if (wallets.length === 0) return;

    for (let wi = 0; wi < wallets.length; wi++) {
      const wallet = wallets[wi];
      try {
        const pubkey = new PublicKey(wallet);
        const sigs = await connection.getSignaturesForAddress(pubkey, { limit: 3 });

        for (let si = 0; si < sigs.length; si++) {
          const sig = sigs[si];
          if (!sig.signature) continue;
          try {
            const tx = await connection.getTransaction(sig.signature, {
              maxSupportedTransactionVersion: 0,
              commitment: 'confirmed',
            });
            if (!tx || !tx.meta) continue;

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
              if (ptb.owner !== wallet) continue;
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
                  const event: AlphaEvent = {
                    wallet: wallet,
                    tokenMint: mint,
                    amountSol: amountSol,
                    timestamp: Date.now(),
                    type: tokenChange > 0 ? 'BUY' : 'SELL',
                  };
                  logger.info('[ALPHA] ' + event.type + ' ' + mint.slice(0, 8) + '... ' + amountSol.toFixed(2) + ' SOL from ' + wallet.slice(0, 8) + '...');
                  if (event.type === 'BUY') {
                    await onSignal(event);
                  }
                }
              }
            }
          } catch (innerErr) {
            // skip individual tx errors
          }
        }
      } catch (err: any) {
        logger.warn('[ALPHA] Monitor error for ' + wallet.slice(0, 8) + ': ' + err.message);
      }
    }
  }, 15000);

  return interval;
}
