"use strict";

const { IPV6_REGEX, getRootDomain } = require("../utils.js");
const { isNonRoutableHost } = require("../background.js");

describe("IPV6_REGEX — all-zeros compressed address (::)", () => {
  test('matches "::" (bare unspecified address)', () => {
    expect(IPV6_REGEX.test("::")).toBe(true);
  });

  test('matches "[::]" (bracketed unspecified address)', () => {
    expect(IPV6_REGEX.test("[::]")).toBe(true);
  });

  test('matches "[::1]" (bracketed loopback)', () => {
    expect(IPV6_REGEX.test("[::1]")).toBe(true);
  });

  test('matches "::1" (bare loopback)', () => {
    expect(IPV6_REGEX.test("::1")).toBe(true);
  });

  test('matches "[fe80::1]" (bracketed link-local)', () => {
    expect(IPV6_REGEX.test("[fe80::1]")).toBe(true);
  });
});

describe("getRootDomain — IPv6 addresses returned as-is", () => {
  test('getRootDomain("::") returns "::"', () => {
    expect(getRootDomain("::")).toBe("::");
  });

  test('getRootDomain("[::]") returns "[::]"', () => {
    expect(getRootDomain("[::]")).toBe("[::]");
  });

  test('getRootDomain("[::1]") returns "[::1]"', () => {
    expect(getRootDomain("[::1]")).toBe("[::1]");
  });

  test('getRootDomain("::1") returns "::1"', () => {
    expect(getRootDomain("::1")).toBe("::1");
  });
});

describe("isNonRoutableHost — unspecified IPv6 address (::)", () => {
  test('isNonRoutableHost("::") returns true', () => {
    expect(isNonRoutableHost("::")).toBe(true);
  });

  test('isNonRoutableHost("[::]") returns true', () => {
    expect(isNonRoutableHost("[::]")).toBe(true);
  });

  test('isNonRoutableHost("[::1]") returns true (loopback)', () => {
    expect(isNonRoutableHost("[::1]")).toBe(true);
  });

  test('isNonRoutableHost("::1") returns true (loopback)', () => {
    expect(isNonRoutableHost("::1")).toBe(true);
  });

  test('isNonRoutableHost("[fe80::1]") returns true (link-local)', () => {
    expect(isNonRoutableHost("[fe80::1]")).toBe(true);
  });

  test('isNonRoutableHost("2001:db8::1") returns false (globally routable)', () => {
    expect(isNonRoutableHost("2001:db8::1")).toBe(false);
  });
});
