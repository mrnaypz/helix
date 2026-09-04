import { getEngine } from "../lib/bot/runtime";

async function main() {
  const engine = await getEngine();
  console.log("Helix bot starting…");
  await engine.start();
  const shutdown = async () => {
    console.log("Stopping…");
    await engine.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
