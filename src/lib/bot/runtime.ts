import { BotEngine } from "./engine";
import { TRADE_LEVERAGE } from "./defaults";

const globalForBot = globalThis as unknown as {
  helixEngine?: BotEngine;
  helixBoot?: Promise<BotEngine>;
};

export async function getEngine(): Promise<BotEngine> {
  if (
    globalForBot.helixEngine &&
    (typeof globalForBot.helixEngine.addLevel !== "function" ||
      typeof globalForBot.helixEngine.state.config.strategy.stopLossPricePct !== "number" ||
      typeof globalForBot.helixEngine.state.config.strategy.breakEvenPricePct !== "number" ||
      typeof globalForBot.helixEngine.state.config.strategy.allowRangeBreakEntry !== "boolean" ||
      typeof globalForBot.helixEngine.state.config.strategy.flattenOnLevelFail !== "boolean" ||
      typeof globalForBot.helixEngine.state.config.strategy.oneToOneTarget !== "boolean" ||
      globalForBot.helixEngine.state.config.strategy.maxLeverage !== TRADE_LEVERAGE ||
      !globalForBot.helixEngine.state.config.coins.includes("HYPE"))
  ) {
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
