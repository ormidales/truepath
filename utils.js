/** Matches a valid IPv4 address (e.g. "192.168.1.1"). */
const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

/**
 * Matches a valid IPv6 address in full, compressed, or bracketed form
 * (e.g. "::1", "fe80::1%eth0", "[fe80::1%eth0]").
 * Supports optional zone identifiers (e.g. "%eth0") and is case-insensitive.
 */
const IPV6_REGEX =
  /^\[?(?:(?:[a-f0-9]{1,4}:){7}[a-f0-9]{1,4}|(?:[a-f0-9]{1,4}:){1,7}:|(?:[a-f0-9]{1,4}:){1,6}:[a-f0-9]{1,4}|(?:[a-f0-9]{1,4}:){1,5}(?::[a-f0-9]{1,4}){1,2}|(?:[a-f0-9]{1,4}:){1,4}(?::[a-f0-9]{1,4}){1,3}|(?:[a-f0-9]{1,4}:){1,3}(?::[a-f0-9]{1,4}){1,4}|(?:[a-f0-9]{1,4}:){1,2}(?::[a-f0-9]{1,4}){1,5}|[a-f0-9]{1,4}:(?:(?::[a-f0-9]{1,4}){1,6})|:(?:(?::[a-f0-9]{1,4}){1,7}|:))(?:%[\w.-]+)?\]?$/i;
const SECOND_LEVEL_SUFFIXES = new Set([
  "ac", "asso", "co", "com", "conf", "edu", "fin", "go", "gov", "gouv",
  "id", "int", "ltd", "me", "mil", "ne", "net", "nom", "or", "org",
  "plc", "sch",
]);

/**
 * Strips surrounding brackets and any zone identifier from an IPv6 address string.
 * Handles both raw form (e.g. `fe80::1%eth0`) and bracketed form (e.g. `[fe80::1%eth0]`).
 * The URL constructor is intentionally not used here because the hostname may arrive
 * without a scheme, making `new URL()` impractical without an artificial prefix.
 *
 * @param {string} host - IPv6 address string, optionally bracketed and/or with a zone ID
 *   (e.g. `[::1]`, `[fe80::1%eth0]`, `fe80::1%eth0`, or a plain bare address like `::1`).
 * @returns {string} Bare lowercase IPv6 address without brackets or zone identifier (e.g. `::1`).
 *   If `host` contains no brackets or zone ID, it is returned lowercased and unchanged.
 *
 * @example
 * stripIPv6Brackets("[::1]")            // → "::1"         (bracketed, no zone ID)
 * stripIPv6Brackets("[fe80::1%eth0]")   // → "fe80::1"     (bracketed with zone ID)
 * stripIPv6Brackets("fe80::1%eth0")     // → "fe80::1"     (raw with zone ID, no brackets)
 * stripIPv6Brackets("::1")             // → "::1"         (already bare, returned lowercased)
 */
const stripIPv6Brackets = (host) => host.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();

/**
 * Returns the registerable root domain for domain-change comparison.
 *
 * Special cases:
 * - Returns `""` for falsy input.
 * - Returns the address as-is for IPv4 (e.g. `"192.168.1.1"`) and IPv6 (e.g. `"[::1]"`).
 * - Returns the hostname lowercased for single-label hostnames (e.g. `"localhost"`, `"com"`).
 * - Filters out empty labels produced by consecutive dots (e.g. `"example..com"` → labels
 *   `["example", "com"]`), so the result is equivalent to the de-duplicated form.
 * - Lowercases non-IP hostnames for normalization before extracting the root domain.
 * - Handles known second-level suffixes (e.g. `"co"`, `"gouv"`) for ccTLDs of length 2.
 *
 * @param {string} hostname - The full hostname to reduce (e.g. `"www.amazon.co.uk"`).
 *   May be an IPv4 address, a bracketed or bare IPv6 address, a single-label name, or
 *   a multi-label domain — including pathological forms with consecutive dots.
 * @returns {string} The registerable root domain (e.g. `"amazon.co.uk"`),
 *   the lowercased single-label hostname (e.g. `"localhost"`, `"com"`),
 *   the IP address unchanged (e.g. `"192.168.1.1"`, `"[::1]"`),
 *   or `""` if `hostname` is falsy.
 *
 * @example
 * getRootDomain("shop.example.fr")   // → "example.fr"
 * getRootDomain("www.amazon.co.uk")  // → "amazon.co.uk"
 * getRootDomain("localhost")         // → "localhost"  (single-label, returned lowercased)
 * getRootDomain("com")              // → "com"        (TLD-only, single-label)
 * getRootDomain("example..com")     // → "example.com" (empty labels from consecutive dots are filtered; effective root domain of the remaining labels)
 * getRootDomain("192.168.1.1")      // → "192.168.1.1" (IPv4, returned as-is)
 * getRootDomain("[::1]")            // → "[::1]"      (IPv6, returned as-is)
 * getRootDomain("")                 // → ""
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
