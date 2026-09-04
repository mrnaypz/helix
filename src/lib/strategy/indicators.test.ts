import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crossedOver, crossedUnder, ema } from "./indicators";

describe("ema", () => {
  it("seeds with SMA then tracks price", () => {
    const values = [1, 2, 3, 4, 5, 6, 7];
    const series = ema(values, 3);
    assert.equal(series.length, 7);
    assert.ok(Number.isNaN(series[0]));
    assert.ok(Number.isNaN(series[1]));
    assert.equal(series[2], 2);
    assert.ok(series[6] > series[5]);
  });
});

describe("crossover", () => {
  it("detects a bullish cross", () => {
    assert.equal(crossedOver(1, 2, 3, 2), true);
    assert.equal(crossedOver(3, 2, 4, 2), false);
  });
  it("detects a bearish cross", () => {
    assert.equal(crossedUnder(3, 2, 1, 2), true);
    assert.equal(crossedUnder(1, 2, 0, 2), false);
  });
});
