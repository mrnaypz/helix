import { ExchangeClient, HttpTransport } from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import type { Network, Side } from "../bot/types";
import { aggressiveLimit, formatPrice, formatSize } from "./format";

function normalizeKey(key: string): `0x${string}` {
  const trimmed = key.trim();
  return (trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`) as `0x${string}`;
}

export function liveEnv() {
  const account = process.env.HL_ACCOUNT_ADDRESS?.trim() || "";
  const key = process.env.HL_AGENT_PRIVATE_KEY?.trim() || "";
  const confirm = process.env.HL_LIVE_CONFIRM?.trim() || "";
  const network = (process.env.HL_NETWORK?.trim() === "mainnet" ? "mainnet" : "testnet") as Network;
  return {
    accountAddress: /^0x[a-fA-F0-9]{40}$/.test(account) ? (account as `0x${string}`) : null,
    hasAgentKey: key.length > 0,
    liveConfirm: confirm === "I_UNDERSTAND",
    network,
    agentKey: key,
  };
}

export function liveReadiness() {
  const env = liveEnv();
  return {
    hasAccount: Boolean(env.accountAddress),
    hasAgentKey: env.hasAgentKey,
    liveConfirm: env.liveConfirm,
    network: env.network,
    accountAddress: env.accountAddress,
  };
}

export function canTradeLive() {
  const env = liveEnv();
  return Boolean(env.accountAddress && env.hasAgentKey && env.liveConfirm);
}

let cached: { key: string; client: ExchangeClient } | null = null;

export function exchangeClient(): ExchangeClient {
  const env = liveEnv();
  if (!env.hasAgentKey) {
    throw new Error("HL_AGENT_PRIVATE_KEY is not set");
  }
  const cacheKey = `${env.network}:${env.agentKey.slice(0, 10)}`;
  if (cached?.key === cacheKey) return cached.client;
  const wallet = privateKeyToAccount(normalizeKey(env.agentKey));
  const transport = new HttpTransport({ isTestnet: env.network === "testnet" });
  const client = new ExchangeClient({ transport, wallet });
  cached = { key: cacheKey, client };
  return client;
}

export async function placeMarketLike(args: {
  assetIndex: number;
  szDecimals: number;
  side: Side;
  size: number;
  mark: number;
  reduceOnly?: boolean;
}) {
  const client = exchangeClient();
  const isBuy = args.side === "long";
  const px = formatPrice(
    aggressiveLimit(args.mark, isBuy ? "buy" : "sell"),
    args.szDecimals,
  );
  const sz = formatSize(args.size, args.szDecimals);
  return client.order({
    orders: [
      {
        a: args.assetIndex,
        b: isBuy,
        p: px,
        s: sz,
        r: Boolean(args.reduceOnly),
        t: { limit: { tif: "Ioc" } },
      },
    ],
    grouping: "na",
  });
}

export async function setLeverage(assetIndex: number, leverage: number) {
  const client = exchangeClient();
  return client.updateLeverage({
    asset: assetIndex,
    isCross: true,
    leverage: Math.max(1, Math.floor(leverage)),
  });
}
