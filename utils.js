/** Storage key used to persist exception domains in browser.storage.sync. */
const STORAGE_KEY = "exceptionDomains";

/** Matches a valid IPv4 address (e.g. "192.168.1.1"). */
const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

/**
 * Matches a valid IPv6 address in full, compressed, or bracketed form
 * (e.g. "::1", "fe80::1%eth0", "[fe80::1%eth0]").
 * Supports optional zone identifiers (e.g. "%eth0") and is case-insensitive.
 */
const IPV6_REGEX =
  /^\[?(?:(?:[a-f0-9]{1,4}:){7}[a-f0-9]{1,4}|(?:[a-f0-9]{1,4}:){1,7}:|(?:[a-f0-9]{1,4}:){1,6}:[a-f0-9]{1,4}|(?:[a-f0-9]{1,4}:){1,5}(?::[a-f0-9]{1,4}){1,2}|(?:[a-f0-9]{1,4}:){1,4}(?::[a-f0-9]{1,4}){1,3}|(?:[a-f0-9]{1,4}:){1,3}(?::[a-f0-9]{1,4}){1,4}|(?:[a-f0-9]{1,4}:){1,2}(?::[a-f0-9]{1,4}){1,5}|[a-f0-9]{1,4}:(?:(?::[a-f0-9]{1,4}){1,6})|:(?:(?::[a-f0-9]{1,4}){1,7}|:))(?:%[\w.-]+)?\]?$/i;

/**
 * Matches a single DNS label that conforms to the LDH (Letters, Digits, Hyphens) rule
 * from RFC 5891. Labels must begin and end with a letter or digit, contain only
 * `[a-z0-9-]`, and be at most 63 characters long. Punycode labels (`xn--...`) satisfy
 * this rule and are therefore accepted.
 */
const LDH_LABEL_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

/**
 * Known two-part public suffixes (second-level + ccTLD) for common country-code TLDs.
 * Used by {@link getRootDomain} to correctly extract the registerable root domain
 * for hostnames whose effective TLD spans two labels (e.g. `co.uk`, `com.br`).
 */
const KNOWN_MULTI_PART_SUFFIXES = new Set([
  // Australia (.au)
  "asn.au", "com.au", "edu.au", "gov.au", "id.au", "net.au", "org.au",
  // Argentina (.ar)
  "com.ar", "edu.ar", "gov.ar", "int.ar", "mil.ar", "net.ar", "org.ar",
  // Bangladesh (.bd)
  "com.bd", "edu.bd", "gov.bd", "mil.bd", "net.bd", "org.bd",
  // Brazil (.br)
  "com.br", "edu.br", "gov.br", "mil.br", "net.br", "nom.br", "org.br",
  // Chile (.cl)
  "com.cl", "edu.cl", "gob.cl", "gov.cl", "mil.cl", "net.cl", "org.cl",
  // China (.cn)
  "ac.cn", "com.cn", "edu.cn", "gov.cn", "mil.cn", "net.cn", "org.cn",
  // Colombia (.co)
  "com.co", "edu.co", "gov.co", "mil.co", "net.co", "org.co",
  // Ecuador (.ec)
  "com.ec", "edu.ec", "fin.ec", "gov.ec", "med.ec", "mil.ec", "net.ec", "org.ec",
  // Ghana (.gh)
  "com.gh", "edu.gh", "gov.gh", "mil.gh", "net.gh", "org.gh",
  // Hong Kong (.hk)
  "com.hk", "edu.hk", "gov.hk", "idv.hk", "net.hk", "org.hk",
  // Indonesia (.id)
  "ac.id", "co.id", "go.id", "mil.id", "net.id", "or.id", "sch.id", "web.id",
  // India (.in)
  "co.in", "edu.in", "firm.in", "gen.in", "gov.in", "ind.in", "mil.in", "net.in", "nic.in", "org.in", "res.in",
  // Israel (.il)
  "ac.il", "co.il", "edu.il", "gov.il", "mil.il", "net.il", "org.il",
  // Japan (.jp)
  "ac.jp", "ad.jp", "co.jp", "ed.jp", "go.jp", "gr.jp", "lg.jp", "ne.jp", "or.jp",
  // Kenya (.ke)
  "ac.ke", "co.ke", "edu.ke", "go.ke", "gov.ke", "mil.ke", "net.ke", "org.ke",
  // South Korea (.kr)
  "ac.kr", "co.kr", "go.kr", "mil.kr", "ne.kr", "or.kr", "pe.kr", "re.kr",
  // Malaysia (.my)
  "com.my", "edu.my", "gov.my", "mil.my", "name.my", "net.my", "org.my",
  // Mexico (.mx)
  "com.mx", "edu.mx", "gob.mx", "net.mx", "org.mx",
  // Nigeria (.ng)
  "com.ng", "edu.ng", "gov.ng", "mil.ng", "net.ng", "org.ng",
  // New Zealand (.nz)
  "ac.nz", "co.nz", "geek.nz", "gen.nz", "govt.nz", "net.nz", "org.nz", "school.nz",
  // Pakistan (.pk)
  "com.pk", "edu.pk", "gov.pk", "mil.pk", "net.pk", "org.pk",
  // Peru (.pe)
  "com.pe", "edu.pe", "gob.pe", "gov.pe", "mil.pe", "net.pe", "nom.pe", "org.pe",
  // Philippines (.ph)
  "com.ph", "edu.ph", "gov.ph", "mil.ph", "net.ph", "ngo.ph", "org.ph",
  // Russia (.ru)
  "com.ru",
  // Singapore (.sg)
  "com.sg", "edu.sg", "gov.sg", "net.sg", "org.sg", "per.sg",
  // Sri Lanka (.lk)
  "com.lk", "edu.lk", "gov.lk", "mil.lk", "net.lk", "org.lk",
  // Taiwan (.tw)
  "club.tw", "com.tw", "ebiz.tw", "edu.tw", "game.tw", "gov.tw", "idv.tw", "mil.tw", "net.tw", "org.tw",
  // Thailand (.th)
  "ac.th", "co.th", "go.th", "in.th", "net.th", "org.th",
  // Turkey (.tr)
  "bel.tr", "com.tr", "edu.tr", "gov.tr", "mil.tr", "net.tr", "org.tr", "pol.tr",
  // Uganda (.ug)
  "co.ug",
  // Ukraine (.ua)
  "com.ua", "edu.ua", "gov.ua", "mil.ua", "net.ua", "org.ua",
  // United Kingdom (.uk)
  "co.uk", "gov.uk", "ltd.uk", "me.uk", "net.uk", "org.uk", "plc.uk", "sch.uk",
  // Uruguay (.uy)
  "com.uy", "edu.uy", "gov.uy", "mil.uy", "net.uy", "org.uy",
  // Venezuela (.ve)
  "com.ve", "edu.ve", "gov.ve", "mil.ve", "net.ve", "org.ve",
  // South Africa (.za)
  "ac.za", "co.za", "edu.za", "gov.za", "law.za", "mil.za", "net.za", "nom.za", "org.za",
  // Zimbabwe (.zw)
  "ac.zw", "co.zw", "edu.zw", "gov.zw", "mil.zw", "net.zw", "org.zw",
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
 * - Validates each label against the LDH (Letters, Digits, Hyphens) rule from RFC 5891.
 *   Hostnames containing labels with non-LDH characters (e.g. Unicode homoglyphs such as
 *   `аmazon.co.uk` with a Cyrillic "а", or labels that exceed 63 characters) are rejected
 *   and `""` is returned, preventing homograph-based bypass attacks.
 * - Filters out empty labels produced by consecutive dots (e.g. `"example..com"` → labels
 *   `["example", "com"]`), so the result is equivalent to the de-duplicated form.
 * - Lowercases non-IP hostnames for normalization before extracting the root domain.
 * - Handles known two-part public suffixes (e.g. `"co.uk"`, `"com.br"`, `"co.jp"`)
 *   via {@link KNOWN_MULTI_PART_SUFFIXES}.
 *
 * @param {string} hostname - The full hostname to reduce (e.g. `"www.amazon.co.uk"`).
 *   May be an IPv4 address, a bracketed or bare IPv6 address, a single-label name, or
 *   a multi-label domain — including pathological forms with consecutive dots.
 * @returns {string} The registerable root domain (e.g. `"amazon.co.uk"`),
 *   the lowercased single-label hostname (e.g. `"localhost"`, `"com"`),
 *   the IP address unchanged (e.g. `"192.168.1.1"`, `"[::1]"`),
 *   `""` if `hostname` is falsy, or `""` if any label fails LDH validation
 *   (e.g. contains Unicode homoglyphs or exceeds 63 characters).
 *
 * @example
 * getRootDomain("shop.example.fr")       // → "example.fr"
 * getRootDomain("www.amazon.co.uk")      // → "amazon.co.uk"
 * getRootDomain("shop.example.com.br")   // → "example.com.br"
 * getRootDomain("www.example.co.jp")     // → "example.co.jp"
 * getRootDomain("localhost")             // → "localhost"  (single-label, returned lowercased)
 * getRootDomain("com")                   // → "com"        (TLD-only, single-label)
 * getRootDomain("example..com")          // → "example.com" (empty labels from consecutive dots are filtered)
 * getRootDomain("192.168.1.1")           // → "192.168.1.1" (IPv4, returned as-is)
 * getRootDomain("[::1]")                 // → "[::1]"      (IPv6, returned as-is)
 * getRootDomain("")                      // → ""
 * getRootDomain("аmazon.co.uk")          // → ""  (Cyrillic homoglyph — non-LDH, rejected)
 * getRootDomain("xn--e1afmapc.com")      // → "xn--e1afmapc.com" (Punycode — LDH-compliant)
 */
const getRootDomain = (hostname) => {
  if (!hostname) {
    return "";
  }

  if (IPV4_REGEX.test(hostname) || IPV6_REGEX.test(hostname)) {
    return hostname;
  }

  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  if (labels.length === 0) {
    return "";
  }

  if (labels.some((label) => !LDH_LABEL_REGEX.test(label))) {
    return "";
  }

  if (labels.length < 2) {
    return labels[0];
  }

  const candidate2 = labels.slice(-2).join(".");
  if (labels.length >= 4) {
    const candidate3 = labels.slice(-3).join(".");
    if (KNOWN_MULTI_PART_SUFFIXES.has(candidate3)) {
      return `${labels[labels.length - 4]}.${candidate3}`;
    }
  }
  if (labels.length >= 3 && KNOWN_MULTI_PART_SUFFIXES.has(candidate2)) {
    return `${labels[labels.length - 3]}.${candidate2}`;
  }

  return candidate2;
};


/* istanbul ignore next */
if (typeof module === "object" && module !== null) {
  module.exports = { STORAGE_KEY, IPV4_REGEX, IPV6_REGEX, stripIPv6Brackets, getRootDomain };
}
