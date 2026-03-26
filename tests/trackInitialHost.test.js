"use strict";

const {
  trackInitialHost,
  initialHostByRequest,
  redirectedRequestIds,
  REQUEST_TRACK_TTL_MS,
  MAX_TRACKED_REQUESTS,
} = require("../background.js");

describe("trackInitialHost eviction", () => {
  beforeEach(() => {
    initialHostByRequest.clear();
    redirectedRequestIds.clear();
  });

  test("bulk-evicts all stale entries when cap is reached", () => {
    const staleTrackedAt = Date.now() - REQUEST_TRACK_TTL_MS - 1;

    // Fill to the cap with stale entries
    for (let i = 0; i < MAX_TRACKED_REQUESTS; i++) {
      initialHostByRequest.set(`stale-${i}`, { host: `stale${i}.example.com`, trackedAt: staleTrackedAt });
      redirectedRequestIds.add(`stale-${i}`);
    }

    trackInitialHost("new-req", "fresh.example.com");

    // All stale entries should have been evicted
    for (let i = 0; i < MAX_TRACKED_REQUESTS; i++) {
      expect(initialHostByRequest.has(`stale-${i}`)).toBe(false);
      expect(redirectedRequestIds.has(`stale-${i}`)).toBe(false);
    }

    // The new entry should have been inserted
    expect(initialHostByRequest.has("new-req")).toBe(true);
    expect(initialHostByRequest.get("new-req").host).toBe("fresh.example.com");
  });

  test("evicts all stale entries from both maps in sync", () => {
    const staleTrackedAt = Date.now() - REQUEST_TRACK_TTL_MS - 1;

    for (let i = 0; i < MAX_TRACKED_REQUESTS; i++) {
      initialHostByRequest.set(`req-${i}`, { host: `h${i}.example.com`, trackedAt: staleTrackedAt });
      redirectedRequestIds.add(`req-${i}`);
    }

    trackInitialHost("new-req-2", "another.example.com");

    // initialHostByRequest and redirectedRequestIds must remain in sync
    for (const key of redirectedRequestIds) {
      expect(initialHostByRequest.has(key)).toBe(true);
    }
  });

  test("falls back to oldest-inserted eviction when no stale entry exists", () => {
    const freshTrackedAt = Date.now();

    // Fill to the cap with fresh entries; first key is "fresh-0"
    for (let i = 0; i < MAX_TRACKED_REQUESTS; i++) {
      initialHostByRequest.set(`fresh-${i}`, { host: `h${i}.example.com`, trackedAt: freshTrackedAt });
    }

    trackInitialHost("fallback-req", "new.example.com");

    // The oldest-inserted entry ("fresh-0") should have been evicted
    expect(initialHostByRequest.has("fresh-0")).toBe(false);

    // All other fresh entries should remain
    for (let i = 1; i < MAX_TRACKED_REQUESTS; i++) {
      expect(initialHostByRequest.has(`fresh-${i}`)).toBe(true);
    }

    // The new entry should have been inserted
    expect(initialHostByRequest.has("fallback-req")).toBe(true);
  });

  test("does not evict anything when below the cap", () => {
    initialHostByRequest.set("existing", { host: "stay.example.com", trackedAt: Date.now() });

    trackInitialHost("new-below-cap", "new.example.com");

    expect(initialHostByRequest.has("existing")).toBe(true);
    expect(initialHostByRequest.has("new-below-cap")).toBe(true);
  });

  test("only stale entries are evicted while fresh ones survive a mixed cap", () => {
    const staleTrackedAt = Date.now() - REQUEST_TRACK_TTL_MS - 1;
    const freshTrackedAt = Date.now();
    const half = Math.floor(MAX_TRACKED_REQUESTS / 2);

    for (let i = 0; i < half; i++) {
      initialHostByRequest.set(`stale-m-${i}`, { host: `s${i}.example.com`, trackedAt: staleTrackedAt });
      redirectedRequestIds.add(`stale-m-${i}`);
    }
    for (let i = 0; i < MAX_TRACKED_REQUESTS - half; i++) {
      initialHostByRequest.set(`fresh-m-${i}`, { host: `f${i}.example.com`, trackedAt: freshTrackedAt });
    }

    trackInitialHost("mixed-new", "mixed.example.com");

    // All stale entries should be gone
    for (let i = 0; i < half; i++) {
      expect(initialHostByRequest.has(`stale-m-${i}`)).toBe(false);
      expect(redirectedRequestIds.has(`stale-m-${i}`)).toBe(false);
    }

    // Fresh entries should still be present
    for (let i = 0; i < MAX_TRACKED_REQUESTS - half; i++) {
      expect(initialHostByRequest.has(`fresh-m-${i}`)).toBe(true);
    }

    // New entry inserted
    expect(initialHostByRequest.has("mixed-new")).toBe(true);
  });
});
