import { AppHeader } from "@/components/app-header";
import { DeskApp } from "@/components/desk-app";
import { getEngine } from "@/lib/bot/runtime";
import type { PublicBotSnapshot } from "@/lib/bot/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const engine = await getEngine();
  const snapshot = JSON.parse(JSON.stringify(engine.snapshot())) as PublicBotSnapshot;

  return (
    <>
      <AppHeader />
      <main>
        <DeskApp initial={snapshot} />
      </main>
    </>
  );
}
