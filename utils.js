/** Matches a valid IPv4 address (e.g. "192.168.1.1"). */
const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

/**
 * Matches a valid IPv6 address in full, compressed, or bracketed form
 * (e.g. "::1", "fe80::1%eth0", "[fe80::1%eth0]").
 * Supports optional zone identifiers (e.g. "%eth0") and is case-insensitive.
 */
const IPV6_REGEX =
  /^\[?(?:(?:[a-f0-9]{1,4}:){7}[a-f0-9]{1,4}|(?:[a-f0-9]{1,4}:){1,7}:|(?:[a-f0-9]{1,4}:){1,6}:[a-f0-9]{1,4}|(?:[a-f0-9]{1,4}:){1,5}(?::[a-f0-9]{1,4}){1,2}|(?:[a-f0-9]{1,4}:){1,4}(?::[a-f0-9]{1,4}){1,3}|(?:[a-f0-9]{1,4}:){1,3}(?::[a-f0-9]{1,4}){1,4}|(?:[a-f0-9]{1,4}:){1,2}(?::[a-f0-9]{1,4}){1,5}|[a-f0-9]{1,4}:(?:(?::[a-f0-9]{1,4}){1,6})|:(?:(?::[a-f0-9]{1,4}){1,7}|:))(?:%[\w.-]+)?\]?$/i;
const SECOND_LEVEL_SUFFIXES = new Set(["ac", "asso", "co", "com", "edu", "gov", "gouv", "net", "nom", "org", "mil", "int", "sch"]);

/**
 * Strips surrounding brackets and any zone identifier from an IPv6 address string.
 * Handles both raw form (e.g. `fe80::1%eth0`) and bracketed form (e.g. `[fe80::1%eth0]`).
 * The URL constructor is intentionally not used here because the hostname may arrive
 * without a scheme, making `new URL()` impractical without an artificial prefix.
 *
 * @param {string} host - IPv6 address, optionally bracketed (e.g. `[::1]` or `fe80::1%eth0`).
 * @returns {string} Bare lowercase IPv6 address without brackets or zone identifier (e.g. `::1`).
 */
const stripIPv6Brackets = (host) => host.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();

/**
 * Returns the registerable root domain for domain-change comparison.
 *
 * Special cases:
 * - Returns "" for falsy input.
 * - Returns the address as-is for IPv4/IPv6.
 * - Returns the hostname lowercased for single-label hostnames (e.g. "localhost").
 * - Lowercases non-IP hostnames for normalization before extracting the root domain.
 * - Handles known second-level suffixes (e.g. "co", "gouv") for ccTLDs of length 2.
 *
 * @param {string} hostname - The full hostname to reduce (e.g. "www.amazon.co.uk").
 * @returns {string} Root domain (e.g. "amazon.co.uk"), or "" if hostname is falsy.
 *
 * @example
 * getRootDomain("shop.example.fr")   // → "example.fr"
 * getRootDomain("www.amazon.co.uk")  // → "amazon.co.uk"
 * getRootDomain("192.168.1.1")       // → "192.168.1.1"
 * getRootDomain("")                  // → ""
 */
const getRootDomain = (hostname) => {
  if (!hostname) {
    return "";
  }

  if (IPV4_REGEX.test(hostname) || IPV6_REGEX.test(hostname)) {
    return hostname;
  }

  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  if (labels.length < 2) {
    return hostname.toLowerCase();
  }

  const tld = labels[labels.length - 1];
  const secondLevel = labels[labels.length - 2];
  if (labels.length >= 3 && tld.length === 2 && SECOND_LEVEL_SUFFIXES.has(secondLevel)) {
    return `${labels[labels.length - 3]}.${secondLevel}.${tld}`;
  }

  return `${labels[labels.length - 2]}.${labels[labels.length - 1]}`;
};
