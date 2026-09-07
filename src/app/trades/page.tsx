import { AppHeader } from "@/components/app-header";
import { TradesApp } from "@/components/trades-app";
import { getEngine } from "@/lib/bot/runtime";
import type { PublicBotSnapshot } from "@/lib/bot/types";

export const dynamic = "force-dynamic";

export default async function TradesPage() {
  const engine = await getEngine();
  const snapshot = JSON.parse(JSON.stringify(engine.snapshot())) as PublicBotSnapshot;

  return (
    <>
      <AppHeader />
      <main>
        <TradesApp initial={snapshot} />
      </main>
    </>
  );
}
