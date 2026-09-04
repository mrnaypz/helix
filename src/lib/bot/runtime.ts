import { BotEngine } from "./engine";

const globalForBot = globalThis as unknown as {
  helixEngine?: BotEngine;
  helixBoot?: Promise<BotEngine>;
};

export async function getEngine(): Promise<BotEngine> {
  if (globalForBot.helixEngine && typeof globalForBot.helixEngine.addLevel !== "function") {
    globalForBot.helixEngine = undefined;
    globalForBot.helixBoot = undefined;
  }
  if (globalForBot.helixEngine) return globalForBot.helixEngine;
  if (!globalForBot.helixBoot) {
    globalForBot.helixBoot = BotEngine.create().then((engine) => {
      globalForBot.helixEngine = engine;
      return engine;
    });
  }
  return globalForBot.helixBoot;
}
