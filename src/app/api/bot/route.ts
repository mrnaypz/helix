import { NextResponse } from "next/server";
import { getEngine } from "@/lib/bot/runtime";
import type { BotConfig, LevelKind } from "@/lib/bot/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const engine = await getEngine();
  return NextResponse.json(engine.snapshot());
}

export async function POST(request: Request) {
  const engine = await getEngine();
  const body = (await request.json()) as {
    action?: string;
    config?: Partial<BotConfig>;
    level?: { coin: string; kind: LevelKind; price: number; note?: string };
    id?: string;
  };

  try {
    switch (body.action) {
      case "start":
        return NextResponse.json(await engine.start());
      case "pause":
        return NextResponse.json(await engine.pause());
      case "stop":
        return NextResponse.json(await engine.stop());
      case "kill":
        return NextResponse.json(await engine.kill());
      case "reset":
        return NextResponse.json(await engine.resetPaper());
      case "tick":
        return NextResponse.json(await engine.tick());
      case "config":
        if (!body.config) {
          return NextResponse.json({ error: "Missing config" }, { status: 400 });
        }
        return NextResponse.json(await engine.applyConfig(body.config));
      case "addLevel":
        if (!body.level) {
          return NextResponse.json({ error: "Missing level" }, { status: 400 });
        }
        return NextResponse.json(await engine.addLevel(body.level));
      case "removeLevel":
        if (!body.id) {
          return NextResponse.json({ error: "Missing level id" }, { status: 400 });
        }
        return NextResponse.json(await engine.removeLevel(body.id));
      case "clearLevels":
        return NextResponse.json(await engine.clearLevels());
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
