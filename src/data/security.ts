import axios from 'axios';
import { logger } from '../utils/logger';

export interface GoPlusResult {
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  canSell: boolean;
  canBuy: boolean;
  ownerCanChangeBalance: boolean;
  isProxy: boolean;
  isMintable: boolean;
  ownerAddress: string;
  unavailable?: boolean; // true jika API tidak bisa dihubungi
}

export async function checkGoPlus(tokenMint: string): Promise<GoPlusResult> {
  try {
    const res = await axios.get(
      'https://api.gopluslabs.io/api/v1/token_security/solana',
      { params: { contract_addresses: tokenMint }, timeout: 10000 }
    );

    const data = res.data?.result?.[tokenMint.toLowerCase()] || {};

    // Jika GoPlus tidak mengenali token = data kosong = anggap belum terverifikasi
    if (Object.keys(data).length === 0) {
      logger.warn('[GOPLUS] Token tidak dikenali: ' + tokenMint.slice(0, 8) + '...');
      return {
        isHoneypot: true,  // fail-safe: token baru/tidak dikenali = treat as risky
        buyTax: 0,
        sellTax: 0,
        canSell: false,
        canBuy: false,
        ownerCanChangeBalance: false,
        isProxy: false,
        isMintable: true,
        ownerAddress: '',
        unavailable: true,
      };
    }

    return {
      isHoneypot: data.is_honeypot === '1',
      buyTax: parseFloat(data.buy_tax || '0'),
      sellTax: parseFloat(data.sell_tax || '0'),
      canSell: data.cannot_sell_all !== '1',
      canBuy: data.cannot_buy !== '1',
      ownerCanChangeBalance: data.owner_can_change_balance === '1',
      isProxy: data.is_proxy === '1',
      isMintable: data.is_mintable === '1',
      ownerAddress: data.owner_address || '',
      unavailable: false,
    };
  } catch (err: any) {
    logger.warn('[GOPLUS] API error: ' + err.message + ' — failing SAFE (treating as risky)');
    // FAIL-SAFE: API tidak bisa dihubungi = anggap berbahaya
    // Jangan kembalikan data "aman" palsu yang bisa menyebabkan beli token rug
    return {
      isHoneypot: false,   // tidak tahu = tidak bisa klaim honeypot
      buyTax: 0,
      sellTax: 0,
      canSell: true,
      canBuy: true,
      ownerCanChangeBalance: false,
      isProxy: false,
      isMintable: false,
      ownerAddress: '',
      unavailable: true,   // flag ini yang penting — security gate akan kurangi score
    };
  }
}
