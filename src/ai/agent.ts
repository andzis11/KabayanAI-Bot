import { Connection } from '@solana/web3.js';
import { logger } from '../utils/logger';
import {
  AIOutput,
  AIAgentConfig,
  DailyState,
  Position,
  FeeMode,
  AlphaWalletEvent,
} from './types';
import { runSecurityGate } from './securityGate';
import { selectFeeMode, calcFeeRatio } from './feeMode';
import { calculatePositionSize, checkCapitalViability } from './positionSizer';
import { runAllEmergencyChecks } from './emergency';
import { checkCooldown } from './cooldown';
import { evaluateAlphaSignal } from './alphaWallet';
import { monitorPosition } from './sltpEngine';
import { savePosition, deletePosition } from '../database/positionRepo';
import { saveDailyState, loadDailyState } from '../database/dailyStatsRepo';

export const DEFAULT_CONFIG: AIAgentConfig = {
  dailyCapital: 1.0,
  baseRiskPercent: 2,
  alphaMultiplier: 1.5,
  feeCap: 0.5,
  minPoolLiquiditySol: 75,
  minPoolLiquidityUsd: 10000,
  minVolumeToMcap: 0.8,
  maxTop10HoldersPercent: 25,
  maxBundledWallets: 5,
  alphaMinSol: 2,
  alphaMaxAgeSeconds: 60,
  circuitBreakerPercent: 15,
  monitoringIntervalMs: 500,
};

export class KabayanAgent {
  private config: AIAgentConfig;
  private dailyState: DailyState;
  private connection: Connection;

  constructor(connection: Connection, config?: Partial<AIAgentConfig>) {
    this.connection = connection;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.dailyState = this.loadOrCreateState();

    // Cek viabilitas modal saat startup
    this.warnIfCapitalTooSmall();
  }

  private warnIfCapitalTooSmall(): void {
    const viability = checkCapitalViability(
      this.config.dailyCapital,
      this.config.baseRiskPercent,
      'NORMAL'
    );
    if (!viability.viable) {
      logger.warn(
        '[AGENT] ⚠️  CAPITAL WARNING: ' + viability.recommendation +
        ' | Fee ratio saat ini: ' + viability.currentFeeRatio.toFixed(1) + '%' +
        ' | Min capital: ' + viability.minCapital.toFixed(3) + ' SOL'
      );
    } else {
      logger.info(
        '[AGENT] Capital check OK: ' + this.config.dailyCapital + ' SOL' +
        ' | Fee ratio: ' + viability.currentFeeRatio.toFixed(1) + '%'
      );
    }
  }

  private loadOrCreateState(): DailyState {
    const today = new Date().toISOString().split('T')[0];
    const saved = loadDailyState(today);
    if (saved) {
      logger.info(
        '[AGENT] Loaded state: ' +
          today +
          ' | PnL: ' +
          saved.dailyPnlPercent.toFixed(2) +
          '%'
      );
      return saved;
    }
    return {
      date: today,
      startingCapital: this.config.dailyCapital,
      currentCapital: this.config.dailyCapital,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      dailyPnlPercent: 0,
      circuitBreakerActive: false,
      circuitBreakerUntil: 0,
      lastTpExit: 0,
      lastSlHit: 0,
      lastRugEmergency: 0,
      positions: [],
    };
  }

  private persistState(): void {
    saveDailyState(this.dailyState);
  }

  async evaluateBuy(
    mint: string,
    devWallet: string | null,
    ageSec: number,
    vol1Min: number,
    buyTxns: number,
    hasAlpha: boolean = false
  ): Promise<AIOutput> {
    const cd = checkCooldown(this.dailyState);
    if (cd.active) {
      return this.makeOutput('TAHAN', 0, 'COOLDOWN_ACTIVE', 'SAFE', 0);
    }

    if (this.dailyState.circuitBreakerActive) {
      return this.makeOutput('TAHAN', 0, 'CIRCUIT_BREAKER', 'SAFE', 0);
    }

    const gate = await runSecurityGate(this.connection, mint, devWallet);
    if (!gate.passed) {
      return this.makeOutput('TAHAN', 0, 'SECURITY_GATE_FAIL', 'SAFE', 0);
    }

    // Pilih fee mode dengan capital-aware logic
    const fm = selectFeeMode({
      tokenAgeSeconds: ageSec,
      action: 'BUY',
      buyTxnsLastBlock: buyTxns,
      volume1MinSol: vol1Min,
      capitalSol: this.dailyState.currentCapital,
    });

    // Hitung position size — sekarang pass feeMode untuk validasi
    const sz = calculatePositionSize(
      this.config,
      hasAlpha,
      this.dailyState.dailyPnlPercent,
      this.dailyState.positions.length,
      fm
    );

    if (sz.sizeSol <= 0) {
      return this.makeOutput('TAHAN', 0, sz.reason, 'SAFE', 0);
    }

    // Log fee ratio sebagai info
    const feeRatio = calcFeeRatio(sz.sizeSol, fm as FeeMode);
    logger.info(
      `[AGENT] BUY signal: ${mint.slice(0, 8)}... | size=${sz.sizeSol.toFixed(4)} SOL | fee=${feeRatio.toFixed(1)}% | mode=${fm}`
    );

    return this.makeOutput(
      'BELI',
      sz.sizeSol / this.config.dailyCapital,
      hasAlpha ? 'ALPHA_SIGNAL' : 'SECURITY_GATE_PASS',
      fm,
      sz.sizeSol
    );
  }

  async evaluateSell(pos: Position, price: number, deployer: string): Promise<AIOutput> {
    const emerg = await runAllEmergencyChecks(pos.tokenMint, deployer);
    if (emerg.triggered) {
      return this.makeOutput('JUAL', 1.0, emerg.reason!, 'AGGRESSIVE', pos.amountSol);
    }

    const res = monitorPosition(pos, price);
    if (res.action === 'SELL') {
      return this.makeOutput(
        'JUAL',
        res.sellPercent,
        res.reason,
        'AGGRESSIVE',
        pos.amountSol * res.sellPercent
      );
    }
    if (res.action === 'TP1') {
      return this.makeOutput(
        'JUAL',
        res.sellPercent,
        'TP1_SECURED',
        'AGGRESSIVE',
        pos.amountSol * res.sellPercent
      );
    }

    return this.makeOutput('TAHAN', 0, 'NO_SIGNAL', pos.feeMode, pos.amountSol);
  }

  async handleAlphaSignal(event: AlphaWalletEvent): Promise<AIOutput> {
    const r = await evaluateAlphaSignal(this.connection, event, this.config);
    if (!r.shouldBuy) {
      return this.makeOutput('TAHAN', 0, 'NO_SIGNAL', 'SAFE', 0);
    }
    return this.evaluateBuy(
      event.tokenMint,
      null,
      (event.timestamp - event.pairCreatedAt) / 1000,
      0,
      0,
      true
    );
  }

  addPosition(pos: Position): void {
    this.dailyState.positions.push(pos);
    this.dailyState.totalTrades++;
    savePosition(pos);
    this.persistState();
    logger.info(
      '[AGENT] Opened: ' +
        pos.tokenMint.slice(0, 8) +
        '... | ' +
        pos.amountSol.toFixed(4) +
        ' SOL'
    );
  }

  updatePosition(pos: Position): void {
    const idx = this.dailyState.positions.findIndex(
      (p) => p.tokenMint === pos.tokenMint
    );
    if (idx >= 0) {
      this.dailyState.positions[idx] = pos;
      savePosition(pos);
    }
  }

  closePosition(mint: string, pnl: number, reason: string): void {
    this.dailyState.positions = this.dailyState.positions.filter(
      (p) => p.tokenMint !== mint
    );
    this.dailyState.currentCapital += pnl;
    this.dailyState.dailyPnlPercent =
      ((this.dailyState.currentCapital - this.dailyState.startingCapital) /
        this.dailyState.startingCapital) *
      100;

    if (pnl > 0) {
      this.dailyState.wins++;
      if (['TP1_SECURED', 'MOONBAG_EXIT'].includes(reason)) {
        this.dailyState.lastTpExit = Date.now();
      }
    } else {
      this.dailyState.losses++
      if (reason === 'HARD_SL') {
        this.dailyState.lastSlHit = Date.now();
      }
    }

    if (this.dailyState.dailyPnlPercent <= -this.config.circuitBreakerPercent) {
      this.dailyState.circuitBreakerActive = true;
      this.dailyState.circuitBreakerUntil = Date.now() + 86400000;
      logger.warn(
        '[AGENT] CIRCUIT BREAKER: ' + this.dailyState.dailyPnlPercent.toFixed(2) + '%'
      );
    }

    if (['RUG_DETECTED', 'LIQUIDITY_DRAINED', 'INSIDER_DUMP'].includes(reason)) {
      this.dailyState.lastRugEmergency = Date.now();
    }

    deletePosition(mint);
    this.persistState();
    logger.info(
      '[AGENT] Closed: ' +
        mint.slice(0, 8) +
        '... | PnL: ' +
        pnl.toFixed(4) +
        ' | ' +
        reason
    );
  }

  private makeOutput(
    aksi: 'BELI' | 'JUAL' | 'TAHAN',
    pct: number,
    alasan: string,
    fm: FeeMode,
    size: number
  ): AIOutput {
    return {
      aksi,
      persentase: pct,
      alasan,
      sl_current: 0,
      trailing_active: false,
      daily_pnl_pct: this.dailyState.dailyPnlPercent,
      fee_mode: fm,
      position_size_sol: size,
    };
  }

  getState(): DailyState {
    return { ...this.dailyState };
  }

  getConfig(): AIAgentConfig {
    return { ...this.config };
  }

  getPositions(): Position[] {
    return [...this.dailyState.positions];
  }
}
