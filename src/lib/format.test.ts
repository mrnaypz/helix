import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatNyTime, relativeTime, relativeTimeLabel } from "./format";

describe("relativeTime", () => {
  const now = Date.UTC(2026, 8, 7, 14, 0, 11);

  it("uses the provided clock, not Date.now", () => {
    assert.equal(relativeTime(now - 10_000, now), "10s ago");
    assert.equal(relativeTime(now - 11_000, now), "11s ago");
  });

  it("keeps a stable placeholder until the client clock is ready", () => {
    assert.equal(relativeTimeLabel(now - 10_000, null), "…");
    assert.equal(relativeTimeLabel(now - 10_000, now), "10s ago");
  });
});

describe("formatNyTime", () => {
  it("formats in America/New_York with en-US", () => {
    const ts = Date.UTC(2026, 8, 7, 13, 30, 0);
    assert.equal(formatNyTime(ts), "09:30 AM");
  });
});
