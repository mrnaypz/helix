#!/usr/bin/env bash
# Run on Napier. Finds Helix, patches candle-quality, prints proof.
set -euo pipefail

ROOT=""
for candidate in "$HOME/hyperliquid-strategy" "$PWD"; do
  if [[ -f "$candidate/src/components/strategy-form.tsx" && -f "$candidate/package.json" ]]; then
    ROOT="$candidate"
    break
  fi
done
if [[ -z "$ROOT" ]]; then
  echo "ERROR: Helix folder not found. Looked in $HOME/hyperliquid-strategy and $PWD"
  echo "Folders in home:"
  ls -1 "$HOME" | head
  exit 1
fi

echo "Found Helix at: $ROOT"
cd "$ROOT"

python3 - <<'PY'
from pathlib import Path
import re
import sys

root = Path.cwd()

def read(rel):
    return (root / rel).read_text()

def write(rel, text):
    (root / rel).write_text(text)

# --- types ---
t = read("src/lib/bot/types.ts")
t2, n = re.subn(r"\n\s*maxBreakThroughAtr:\s*number;", "\n  minPrevBodyAtr: number;", t, count=1)
if "minPrevBodyAtr" not in t2:
    t2, n2 = re.subn(r"(\n\s*)minEngulfBodyAtr:\s*number;", r"\1minPrevBodyAtr: number;\1minEngulfBodyAtr: number;", t2, count=1)
    if n2 == 0:
        sys.exit("types.ts: could not add minPrevBodyAtr")
write("src/lib/bot/types.ts", t2)
print("types.ts ok")

# --- defaults ---
d = read("src/lib/bot/defaults.ts")
d2, n = re.subn(r"\n\s*maxBreakThroughAtr:\s*1\.5,", "\n  minPrevBodyAtr: 0.25,", d, count=1)
if "minPrevBodyAtr" not in d2:
    d2, n2 = re.subn(r"(\n\s*)minEngulfBodyAtr:\s*0\.25,", r"\1minPrevBodyAtr: 0.25,\1minEngulfBodyAtr: 0.25,", d2, count=1)
    if n2 == 0:
        sys.exit("defaults.ts: could not add minPrevBodyAtr")
write("src/lib/bot/defaults.ts", d2)
print("defaults.ts ok")

# --- store ---
s = read("src/lib/bot/store.ts")
if "function clampAtrMult" not in s:
    s = s.replace(
        "function migrateStrategy",
        """function clampAtrMult(value: number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, value);
  if (typeof fallback === "number" && Number.isFinite(fallback)) return Math.max(0, fallback);
  return 0;
}

function migrateStrategy""",
        1,
    )
s = re.sub(
    r"\n\s*maxBreakThroughAtr:\s*incoming\.maxBreakThroughAtr\s*\?\?\s*DEFAULT_STRATEGY\.maxBreakThroughAtr,",
    "",
    s,
    count=1,
)
if "minPrevBodyAtr:" not in s:
    s = s.replace(
        "minEngulfBodyAtr: incoming.minEngulfBodyAtr ?? DEFAULT_STRATEGY.minEngulfBodyAtr,",
        """minEngulfBodyAtr: clampAtrMult(incoming.minEngulfBodyAtr, DEFAULT_STRATEGY.minEngulfBodyAtr),
    minPrevBodyAtr: clampAtrMult(
      incoming.minPrevBodyAtr,
      incoming.minEngulfBodyAtr ?? DEFAULT_STRATEGY.minPrevBodyAtr,
    ),""",
        1,
    )
write("src/lib/bot/store.ts", s)
print("store.ts ok")

# --- runtime ---
r = read("src/lib/bot/runtime.ts")
r = re.sub(
    r"\s*typeof globalForBot\.helixEngine\.state\.config\.strategy\.maxBreakThroughAtr !== \"number\" \|\|\n",
    "\n",
    r,
    count=1,
)
if "minPrevBodyAtr" not in r:
    r = r.replace(
        'typeof globalForBot.helixEngine.state.config.strategy.minEngulfBodyAtr !== "number" ||',
        'typeof globalForBot.helixEngine.state.config.strategy.minPrevBodyAtr !== "number" ||\n      typeof globalForBot.helixEngine.state.config.strategy.minEngulfBodyAtr !== "number" ||',
        1,
    )
write("src/lib/bot/runtime.ts", r)
print("runtime.ts ok")

# --- price-action engine ---
p = read("src/lib/strategy/price-action.ts")
p = re.sub(
    r"export function breakTooFarThroughLevel\([\s\S]*?\n\}\n\n",
    "",
    p,
    count=1,
)
p = re.sub(
    r"export function engulfingMeetsQuality\(args: \{[\s\S]*?maxOpposingWickFrac: number;\n\}\): boolean \{[\s\S]*?return opposingWickFraction\(curr, side\) \+ 1e-12 < maxOpposingWickFrac;\n\}",
    """function minBodyNeed(atr: number, minAtr: number): number {
  if (!(minAtr > 0)) return 0;
  return minAtr * atr;
}

export function engulfingMeetsQuality(args: {
  prev: Candle;
  curr: Candle;
  side: "long" | "short";
  atr: number;
  minPrevBodyAtr: number;
  minTriggerBodyAtr: number;
  maxOpposingWickFrac: number;
}): boolean {
  const { prev, curr, side, atr, minPrevBodyAtr, minTriggerBodyAtr, maxOpposingWickFrac } = args;
  if (atr <= 0) return false;
  if (candleBody(prev) + 1e-12 < minBodyNeed(atr, minPrevBodyAtr)) return false;
  if (candleBody(curr) + 1e-12 < minBodyNeed(atr, minTriggerBodyAtr)) return false;
  return opposingWickFraction(curr, side) + 1e-12 < maxOpposingWickFrac;
}

function atrNeedLabel(minAtr: number, what: string): string {
  if (!(minAtr > 0)) return `no min ${what}`;
  return `${minAtr}× ATR ${what}`;
}""",
    p,
    count=1,
)
p = re.sub(
    r"if \(longBreak \|\| shortBreak\) \{\n\s*const atr = atrPriorTo\(history, atrValues, curr\.t\);\n\s*if \(breakTooFarThroughLevel\([\s\S]*?break;\n\s*\}\n\s*phase = \"broken\";",
    'if (longBreak || shortBreak) {\n        phase = "broken";',
    p,
    count=1,
)
p = p.replace(
    "minBodyAtr: config.minEngulfBodyAtr ?? 0.25,",
    "minPrevBodyAtr: config.minPrevBodyAtr ?? config.minEngulfBodyAtr ?? 0.25,\n        minTriggerBodyAtr: config.minEngulfBodyAtr ?? 0.25,",
    1,
)
p = p.replace(
    "Rejected engulfing — need ${quality.minBodyAtr}× ATR bodies and opposing wick under ${Math.round(quality.maxOpposingWickFrac * 100)}%",
    'Rejected engulfing — need ${atrNeedLabel(quality.minPrevBodyAtr, "previous body")}, ${atrNeedLabel(quality.minTriggerBodyAtr, "engulfing body")}, opposing wick under ${Math.round(quality.maxOpposingWickFrac * 100)}%',
    1,
)
if "breakTooFarThroughLevel" in p:
    sys.exit("price-action.ts still has blow-through after patch")
if "minPrevBodyAtr" not in p:
    sys.exit("price-action.ts missing minPrevBodyAtr after patch")
write("src/lib/strategy/price-action.ts", p)
print("price-action.ts ok")

# --- Rules form (this is what Brave shows) ---
f = read("src/components/strategy-form.tsx")
f2, n = re.subn(
    r'<Num\s+label="Max break through \(× ATR\)"[\s\S]*?/>',
    '''<Num
            label="Min previous body (× ATR)"
            value={s.minPrevBodyAtr ?? s.minEngulfBodyAtr ?? 0.25}
            step="0.05"
            onChange={(v) => setS({ minPrevBodyAtr: Number.isFinite(v) ? Math.max(0, v) : 0 })}
          />''',
    f,
    count=1,
)
if n == 0 and "Min previous body" not in f2:
    sys.exit("strategy-form.tsx: Max break through field not found")
f2 = re.sub(
    r"A break that closes more than 1\.5× that through the level is dead — no\s+consolidation, no trade\.\s+",
    "A close through the level still counts as a break even if it is a large candle. ",
    f2,
    count=1,
)
write("src/components/strategy-form.tsx", f2)
print("strategy-form.tsx ok")

form = read("src/components/strategy-form.tsx")
print("--- proof ---")
print("Max break through present:", "Max break through" in form)
print("Min previous body present:", "Min previous body" in form)
if "Max break through" in form:
    sys.exit("FAIL: form still has Max break through")
if "Min previous body" not in form:
    sys.exit("FAIL: form missing Min previous body")
print("PATCH OK")
PY

echo
echo "Next: if npm is running, press Ctrl+C in that window."
echo "Then start Helix FROM THIS FOLDER only:"
echo "  cd $ROOT"
echo "  npm run dev"
echo "Then in Brave: Ctrl+Shift+R on Rules."
