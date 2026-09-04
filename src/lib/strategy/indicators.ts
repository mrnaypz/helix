import type { Candle } from "../bot/types";

export function ema(values: number[], period: number): number[] {
  if (period < 1) throw new Error("EMA period must be >= 1");
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const price = values[i];
    if (i + 1 < period) {
      out.push(Number.NaN);
      continue;
    }
    if (prev === null) {
      const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      out.push(seed);
      continue;
    }
    prev = price * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function trueRange(candles: Candle[]): number[] {
  const tr: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    const high = candles[i].h;
    const low = candles[i].l;
    if (i === 0) {
      tr.push(high - low);
      continue;
    }
    const prevClose = candles[i - 1].c;
    tr.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  return tr;
}

export function atr(candles: Candle[], period: number): number[] {
  const tr = trueRange(candles);
  const out: number[] = [];
  let prev: number | null = null;
  for (let i = 0; i < tr.length; i++) {
    if (i + 1 < period) {
      out.push(Number.NaN);
      continue;
    }
    if (prev === null) {
      const seed = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
      prev = seed;
      out.push(seed);
      continue;
    }
    prev = (prev * (period - 1) + tr[i]) / period;
    out.push(prev);
  }
  return out;
}

export function lastFinite(values: number[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    if (Number.isFinite(values[i])) return values[i];
  }
  return null;
}

export function crossedOver(prevFast: number, prevSlow: number, fast: number, slow: number): boolean {
  return prevFast <= prevSlow && fast > slow;
}

export function crossedUnder(prevFast: number, prevSlow: number, fast: number, slow: number): boolean {
  return prevFast >= prevSlow && fast < slow;
}
