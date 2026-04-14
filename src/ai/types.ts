export type Aksi = 'BELI' | 'JUAL' | 'TAHAN';
export type FeeMode = 'SAFE' | 'NORMAL' | 'AGGRESSIVE';

export interface AIOutput {
  aksi: Aksi;
  persentase: number;
  alasan: string;
  sl_current: number;
  trailing_active: boolean;
  daily_pnl_pct: number;
  fee_mode: FeeMode;
  position_size_sol: number;
}

export interface SecurityGateResult {
  passed: boolean;
  checks: {
    mint_authority_disabled: boolean;
    freeze_authority_disabled: boolean;
    transfer_simulation_ok: boolean;
    top10_holders_ok: boolean;
    bundled_supply_ok: boolean;
    pool_liquidity_ok: boolean;
    volume_to_mcap_ok: boolean;
    dev_wallet_clean: boolean;
  };
  failedReason: string | null;
}

export interface Position {
  tokenMint: string;
  entryPrice: number;
  amount: number;
  amountSol: number;
  initialSL: number;
  trailingDelta: number;
  trailingActivation: number;
  tp1Target: number;
  peak: number;
  trailingActive: boolean;
  isMoonbag: boolean;
  moonbagSL: number;
  ath: number;
  timestamp: number;
  feeMode: FeeMode;
  alphaSignal: boolean;
}

export interface AlphaWalletEvent {
  wallet: string;
  tokenMint: string;
  amountSol: number;
  pairCreatedAt: number;
  timestamp: number;
}

export interface AIAgentConfig {
  dailyCapital: number;
  baseRiskPercent: number;
  alphaMultiplier: number;
  feeCap: number;
  minPoolLiquiditySol: number;
  minPoolLiquidityUsd: number;
  minVolumeToMcap: number;
  maxTop10HoldersPercent: number;
  maxBundledWallets: number;
  alphaMinSol: number;
  alphaMaxAgeSeconds: number;
  circuitBreakerPercent: number;
  monitoringIntervalMs: number;
}

export interface DailyState {
  date: string;
  startingCapital: number;
  currentCapital: number;
  totalTrades: number;
  wins: number;
  losses: number;
  dailyPnlPercent: number;
  circuitBreakerActive: boolean;
  circuitBreakerUntil: number;
  lastTpExit: number;
  lastSlHit: number;
  lastRugEmergency: number;
  positions: Position[];
}

