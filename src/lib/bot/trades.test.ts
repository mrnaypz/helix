import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Fill, Position } from "./types";
import { closedTradesFromFills, snapshotClosedTrade } from "./trades";

function long(extra: Partial<Position> = {}): Position {
  return {
    coin: "HYPE",
    side: "long",
    size: 100,
    entryPrice: 40,
    markPrice: 40.4,
    stopPrice: 39.8,
    takePrice: 40.4,
    leverage: 10,
    notional: 4000,
    unrealizedPnl: 40,
    openedAt: 1_000,
    atrAtEntry: 0.2,
    breakEvenStop: false,
    giveUpArmedBarTime: null,
    levelPrice: 39.9,
    entryBarTime: 900,
    ...extra,
  };
}

function fill(extra: Partial<Fill> = {}): Fill {
  return {
    id: "fill_1",
    ts: 2_000,
    coin: "HYPE",
    side: "long",
    action: "close",
    reason: "Take-profit — 1% from entry",
    size: 100,
    price: 40.4,
    fee: 1.4,
    pnl: 38.6,
    mode: "paper",
    ...extra,
  };
}

describe("closed trade recap", () => {
  it("snapshots size, entry, exit, stop, target, level, and ROE", () => {
    const recap = snapshotClosedTrade(long(), fill());
    assert.equal(recap.complete, true);
    assert.equal(recap.size, 100);
    assert.equal(recap.entryPrice, 40);
    assert.equal(recap.exitPrice, 40.4);
    assert.equal(recap.notional, 4000);
    assert.equal(recap.margin, 400);
    assert.ok(Math.abs(recap.priceMovePct - 1) < 1e-9);
    assert.ok(Math.abs(recap.roePct - 9.65) < 1e-9);
    assert.equal(recap.stopPrice, 39.8);
    assert.equal(recap.takePrice, 40.4);
    assert.equal(recap.levelPrice, 39.9);
    assert.ok(recap.stopPct != null && recap.stopPct < 0);
    assert.ok(recap.takePct != null && recap.takePct > 0);
  });

  it("rebuilds a thinner recap from open and close fills", () => {
    const recaps = closedTradesFromFills([
      fill({
        id: "c1",
        ts: 2_000,
        action: "close",
        price: 39.7,
        pnl: -30,
        reason: "Stop — 0.5% from entry",
      }),
      fill({
        id: "o1",
        ts: 1_000,
        action: "open",
        price: 40,
        pnl: 0,
        reason: "entry",
      }),
    ]);
    assert.equal(recaps.length, 1);
    assert.equal(recaps[0]?.complete, false);
    assert.equal(recaps[0]?.entryPrice, 40);
    assert.equal(recaps[0]?.exitPrice, 39.7);
    assert.equal(recaps[0]?.stopPrice, null);
    assert.equal(recaps[0]?.levelPrice, null);
    assert.ok((recaps[0]?.priceMovePct ?? 0) < 0);
  });

  it("pairs fills stored newest-first the way the desk keeps them", () => {
    const recaps = closedTradesFromFills([
      fill({ id: "c1", ts: 5_000, action: "close", price: 39.8, pnl: -20 }),
      fill({ id: "o1", ts: 4_000, action: "open", price: 40, pnl: 0, reason: "entry" }),
    ]);
    assert.equal(recaps[0]?.entryPrice, 40);
    assert.equal(recaps[0]?.exitPrice, 39.8);
  });
});
