import { NextResponse } from "next/server";
import { liveReadiness } from "@/lib/hyperliquid/exchange";
import { fetchClearinghouse, fetchOpenOrders } from "@/lib/hyperliquid/info";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const live = liveReadiness();
  if (!live.accountAddress) {
    return NextResponse.json({ live, account: null, openOrders: [] });
  }
  try {
    const [account, openOrders] = await Promise.all([
      fetchClearinghouse(live.network, live.accountAddress),
      fetchOpenOrders(live.network, live.accountAddress),
    ]);
    return NextResponse.json({ live, account, openOrders });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ live, error: message }, { status: 502 });
  }
}
