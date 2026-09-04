import { HttpTransport, InfoClient } from "@nktkas/hyperliquid";
import { INTERVAL_MS } from "../bot/defaults";
import type { Candle, Interval, MarketSnapshot, Network } from "../bot/types";

const clients = new Map<Network, InfoClient>();

export function infoClient(network: Network): InfoClient {
  const existing = clients.get(network);
  if (existing) return existing;
  const transport = new HttpTransport({ isTestnet: network === "testnet" });
  const client = new InfoClient({ transport });
  clients.set(network, client);
  return client;
}

function closedCandles(raw: Array<{
  t: number;
  T: number;
  s: string;
  i: string;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
  n: number;
}>, now = Date.now()): Candle[] {
  return raw
    .filter((c) => c.T <= now)
    .map((c) => ({
      t: c.t,
      T: c.T,
      s: c.s,
      i: c.i,
      o: Number(c.o),
      h: Number(c.h),
      l: Number(c.l),
      c: Number(c.c),
      v: Number(c.v),
      n: c.n,
    }));
}

export async function fetchCandles(args: {
  network: Network;
  coin: string;
  interval: Interval;
  count?: number;
}): Promise<Candle[]> {
  const count = args.count ?? 200;
  const span = INTERVAL_MS[args.interval] * count;
  const endTime = Date.now();
  const data = await infoClient(args.network).candleSnapshot({
    coin: args.coin,
    interval: args.interval,
    startTime: endTime - span,
    endTime,
  });
  return closedCandles(data);
}

export async function fetchMarkets(network: Network, coins: string[]): Promise<MarketSnapshot[]> {
  const [meta, ctxs] = await infoClient(network).metaAndAssetCtxs();
  const wanted = new Set(coins);
  const snapshots: MarketSnapshot[] = [];
  meta.universe.forEach((asset, index) => {
    if (!wanted.has(asset.name)) return;
    const ctx = ctxs[index];
    if (!ctx) return;
    const markPx = Number(ctx.markPx);
    const prevDayPx = Number(ctx.prevDayPx);
    snapshots.push({
      coin: asset.name,
      markPx,
      midPx: ctx.midPx ? Number(ctx.midPx) : markPx,
      funding: Number(ctx.funding),
      prevDayPx,
      dayNtlVlm: Number(ctx.dayNtlVlm),
      openInterest: Number(ctx.openInterest),
      szDecimals: asset.szDecimals,
      maxLeverage: asset.maxLeverage,
      assetIndex: index,
      changePct: prevDayPx ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0,
    });
  });
  return snapshots;
}

export async function fetchClearinghouse(network: Network, user: `0x${string}`) {
  return infoClient(network).clearinghouseState({ user });
}

export async function fetchOpenOrders(network: Network, user: `0x${string}`) {
  return infoClient(network).openOrders({ user });
}
