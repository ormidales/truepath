"use strict";

const {
  cleanupStaleTrackedRequests,
  initialHostByRequest,
  redirectedRequestIds,
  REQUEST_TRACK_TTL_MS,
} = require("../background.js");

describe("cleanupStaleTrackedRequests", () => {
  beforeEach(() => {
    initialHostByRequest.clear();
    redirectedRequestIds.clear();
  });

  test("removes entries older than TTL", () => {
    const now = 1_000_000;
    initialHostByRequest.set("req-1", { host: "example.com", trackedAt: now - REQUEST_TRACK_TTL_MS - 1 });

    cleanupStaleTrackedRequests(now);

    expect(initialHostByRequest.has("req-1")).toBe(false);
  });

  test("preserves entries within TTL", () => {
    const now = 1_000_000;
    initialHostByRequest.set("req-2", { host: "example.com", trackedAt: now - REQUEST_TRACK_TTL_MS + 1 });

    cleanupStaleTrackedRequests(now);

    expect(initialHostByRequest.has("req-2")).toBe(true);
  });

  test("also removes requestId from redirectedRequestIds", () => {
    const now = 1_000_000;
    initialHostByRequest.set("req-3", { host: "example.com", trackedAt: now - REQUEST_TRACK_TTL_MS - 1 });
    redirectedRequestIds.add("req-3");

    cleanupStaleTrackedRequests(now);

    expect(initialHostByRequest.has("req-3")).toBe(false);
    expect(redirectedRequestIds.has("req-3")).toBe(false);
  });

  test("no-op on empty map", () => {
    expect(() => cleanupStaleTrackedRequests(1_000_000)).not.toThrow();
    expect(initialHostByRequest.size).toBe(0);
    expect(redirectedRequestIds.size).toBe(0);
  });
});
