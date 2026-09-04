"use client";

import { useState } from "react";
import { LevelsBoard } from "@/components/levels-board";
import type { PublicBotSnapshot } from "@/lib/bot/types";

export function LevelsLive({ initial }: { initial: PublicBotSnapshot }) {
  const [snap, setSnap] = useState(initial);
  return <LevelsBoard snapshot={snap} onChange={setSnap} />;
}
