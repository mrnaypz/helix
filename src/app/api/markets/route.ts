import { NextResponse } from "next/server";
import { fetchMarkets } from "@/lib/hyperliquid/info";
import { DEFAULT_CONFIG } from "@/lib/bot/defaults";
import { getEngine } from "@/lib/bot/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const engine = await getEngine();
    const coins = engine.state.config.coins.length ? engine.state.config.coins : DEFAULT_CONFIG.coins;
    const network = engine.state.config.mode === "live" ? engine.snapshot().live.network : engine.state.config.network;
    const markets = await fetchMarkets(network, coins);
    return NextResponse.json({ markets, network });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
