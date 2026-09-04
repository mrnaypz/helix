/** Hyperliquid perp price/size rounding. */

function trimZeros(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/\.?0+$/, "");
}

export function formatPrice(price: number, szDecimals: number): string {
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error(`Invalid price ${price}`);
  }
  const maxDecimals = Math.max(0, 6 - szDecimals);
  const asPrecision = Number(price.toPrecision(5));
  const rounded = Number(asPrecision.toFixed(maxDecimals));
  if (rounded <= 0) {
    throw new Error(`Rounded price is zero for ${price}`);
  }
  return trimZeros(rounded.toFixed(maxDecimals));
}

export function formatSize(size: number, szDecimals: number): string {
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error(`Invalid size ${size}`);
  }
  const rounded = Number(size.toFixed(szDecimals));
  if (rounded <= 0) {
    throw new Error(`Rounded size is zero for ${size}`);
  }
  return trimZeros(rounded.toFixed(szDecimals));
}

export function aggressiveLimit(mark: number, side: "buy" | "sell", bps = 15): number {
  const slip = mark * (bps / 10_000);
  return side === "buy" ? mark + slip : Math.max(mark - slip, mark * 0.0001);
}
