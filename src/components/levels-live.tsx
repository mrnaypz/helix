"use client";

import { LevelsBoard } from "@/components/levels-board";
import type { PublicBotSnapshot } from "@/lib/bot/types";

export function LevelsLive({ initial }: { initial: PublicBotSnapshot }) {
  return <LevelsBoard snapshot={initial} />;
}
