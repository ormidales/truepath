"use strict";

const { IPV6_REGEX, getRootDomain } = require("../utils.js");
const { isNonRoutableHost, buildAcceptLanguage, DEFAULT_ACCEPT_LANGUAGE } = require("../background.js");

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

describe("getRootDomain — 4-label hostname with known 2-label suffix", () => {
  test('getRootDomain("shop.example.co.uk") returns "example.co.uk"', () => {
    expect(getRootDomain("shop.example.co.uk")).toBe("example.co.uk");
  });

  test('getRootDomain("www.store.com.br") returns "store.com.br"', () => {
    expect(getRootDomain("www.store.com.br")).toBe("store.com.br");
  });
});

describe("IPV6_REGEX — full 8-group uncompressed address", () => {
  test('matches full 8-group address', () => {
    expect(IPV6_REGEX.test("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(true);
  });

  test('matches bracketed full 8-group address', () => {
    expect(IPV6_REGEX.test("[2001:0db8:85a3:0000:0000:8a2e:0370:7334]")).toBe(true);
  });

  test('does not match malformed address (9 groups)', () => {
    expect(IPV6_REGEX.test("2001:0db8:85a3:0000:0000:8a2e:0370:7334:0001")).toBe(false);
  });
});

describe("getRootDomain — full 8-group IPv6 address returned as-is", () => {
  test('getRootDomain("2001:0db8:85a3:0000:0000:8a2e:0370:7334") returns the address unchanged', () => {
    expect(getRootDomain("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
  });

  test('getRootDomain("[2001:0db8:85a3:0000:0000:8a2e:0370:7334]") returns the bracketed address unchanged', () => {
    expect(getRootDomain("[2001:0db8:85a3:0000:0000:8a2e:0370:7334]")).toBe("[2001:0db8:85a3:0000:0000:8a2e:0370:7334]");
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

describe("isNonRoutableHost — full 8-group IPv6 address", () => {
  test('isNonRoutableHost("2001:0db8:85a3:0000:0000:8a2e:0370:7334") returns false (documentation prefix, non-private)', () => {
    expect(isNonRoutableHost("2001:0db8:85a3:0000:0000:8a2e:0370:7334")).toBe(false);
  });

  test('isNonRoutableHost("[2001:0db8:85a3:0000:0000:8a2e:0370:7334]") returns false (bracketed documentation prefix, non-private)', () => {
    expect(isNonRoutableHost("[2001:0db8:85a3:0000:0000:8a2e:0370:7334]")).toBe(false);
  });
});

describe("buildAcceptLanguage — IPv6 addresses return DEFAULT_ACCEPT_LANGUAGE", () => {
  test('buildAcceptLanguage("[::1]") returns DEFAULT_ACCEPT_LANGUAGE (bracketed IPv6 fallback)', () => {
    expect(buildAcceptLanguage("[::1]")).toBe(DEFAULT_ACCEPT_LANGUAGE);
  });

  test('buildAcceptLanguage("::1") returns DEFAULT_ACCEPT_LANGUAGE (bare IPv6 fallback)', () => {
    expect(buildAcceptLanguage("::1")).toBe(DEFAULT_ACCEPT_LANGUAGE);
  });
});
