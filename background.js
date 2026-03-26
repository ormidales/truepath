/**
 * Tracks the hostname of the first request for each active requestId.
 * Cleared on request completion, error, or TTL expiry.
 * @type {Map<string, {host: string, trackedAt: number}>}
 */
const initialHostByRequest = new Map();

/**
 * Tracks request IDs for which at least one redirect has been observed.
 * Only requests in this set will have their Accept-Language header spoofed.
 * Cleared on request completion, error, or TTL eviction alongside initialHostByRequest.
 * @type {Set<string>}
 */
const redirectedRequestIds = new Set();

/**
 * Removes all tracking state associated with a given request ID.
 * Ensures `initialHostByRequest` and `redirectedRequestIds` stay in sync.
 *
 * @param {string} requestId The WebExtensions request identifier to clean up.
 */
function cleanupTrackedRequest(requestId) {
  initialHostByRequest.delete(requestId);
  redirectedRequestIds.delete(requestId);
}

/**
 * Maximum number of concurrent request IDs tracked before LRU eviction.
 * Chosen to comfortably cover burst tab-open scenarios (e.g. restoring a
 * session with many tabs) while keeping memory overhead negligible.
 * Increase only if profiling shows eviction occurring under normal usage.
 * @type {number}
 */
const MAX_TRACKED_REQUESTS = 1000;

/**
 * Time-to-live for a tracked request entry, in milliseconds.
 * Requests stalled longer than this value (e.g. due to slow DNS or a hanging
 * server) are considered abandoned and become candidates for eviction.
 * Should be longer than any realistic page-load timeout.
 * @type {number}
 */
const REQUEST_TRACK_TTL_MS = 60 * 1_000; // 60 seconds

/**
 * In-memory set of root domains excluded from redirect blocking.
 * Domains in this set will not have their cross-TLD redirects cancelled.
 * Accept-Language spoofing still applies to these domains.
 * Populated at startup and kept in sync via `storage.onChanged`.
 * @type {Set<string>}
 */
const exceptionDomains = new Set();

/**
 * Fallback Accept-Language header value used when no TLD-specific mapping is found
 * in ACCEPT_LANGUAGE_BY_TLD. Follows RFC 4647 / HTTP Accept-Language syntax.
 * Returned by buildAcceptLanguage() for IP addresses and hostnames whose
 * derived TLD is not present in ACCEPT_LANGUAGE_BY_TLD.
 *
 * @type {string}
 */
const DEFAULT_ACCEPT_LANGUAGE = "en-US,en;q=0.9";

/**
 * Maps country-code TLDs to their typical Accept-Language header value.
 * Used to adjust the outgoing Accept-Language request header so it matches
 * the requested domain's locale, which helps prevent geo-redirect loops
 * triggered by Accept-Language mismatch.
 *
 * To add a new TLD: add ["tld", "lang-REGION,lang;q=0.9,en;q=0.7"] in
 * alphabetical order by the TLD key. Keys must be lowercase TLD labels
 * (no leading dot). Values follow RFC 4647 / HTTP Accept-Language syntax.
 *
 * @type {Map<string, string>}
 */
const ACCEPT_LANGUAGE_BY_TLD = new Map([
  ["ae", "ar-AE,ar;q=0.9,en;q=0.7"],
  ["ar", "es-AR,es;q=0.9,en;q=0.7"],
  ["at", "de-AT,de;q=0.9,en;q=0.7"],
  ["au", "en-AU,en;q=0.9"],
  ["be", "nl-BE,nl;q=0.9,fr;q=0.8,en;q=0.7"],
  ["bg", "bg-BG,bg;q=0.9,en;q=0.7"],
  ["br", "pt-BR,pt;q=0.9,en;q=0.7"],
  ["ca", "en-CA,en;q=0.9,fr;q=0.8"],
  ["ch", "de-CH,de;q=0.9,fr;q=0.8,it;q=0.7,en;q=0.6"],
  ["cn", "zh-CN,zh;q=0.9,en;q=0.7"],
  ["cz", "cs-CZ,cs;q=0.9,en;q=0.7"],
  ["de", "de-DE,de;q=0.9,en;q=0.7"],
  ["dk", "da-DK,da;q=0.9,en;q=0.7"],
  ["ee", "et-EE,et;q=0.9,en;q=0.7"],
  ["es", "es-ES,es;q=0.9,en;q=0.7"],
  ["fi", "fi-FI,fi;q=0.9,en;q=0.7"],
  ["fr", "fr-FR,fr;q=0.9,en;q=0.7"],
  ["gr", "el-GR,el;q=0.9,en;q=0.7"],
  ["hr", "hr-HR,hr;q=0.9,en;q=0.7"],
  ["hu", "hu-HU,hu;q=0.9,en;q=0.7"],
  ["id", "id-ID,id;q=0.9,en;q=0.7"],
  ["ie", "en-IE,en;q=0.9"],
  ["il", "he-IL,he;q=0.9,en;q=0.7"],
  ["in", "en-IN,en;q=0.9,hi;q=0.8"],
  ["it", "it-IT,it;q=0.9,en;q=0.7"],
  ["jp", "ja-JP,ja;q=0.9,en;q=0.7"],
  ["kr", "ko-KR,ko;q=0.9,en;q=0.7"],
  ["lt", "lt-LT,lt;q=0.9,en;q=0.7"],
  ["lv", "lv-LV,lv;q=0.9,en;q=0.7"],
  ["mx", "es-MX,es;q=0.9,en;q=0.7"],
  ["nl", "nl-NL,nl;q=0.9,en;q=0.7"],
  ["no", "nb-NO,nn-NO,nb;q=0.9,nn;q=0.8,en;q=0.7"],
  ["nz", "en-NZ,en;q=0.9"],
  ["pl", "pl-PL,pl;q=0.9,en;q=0.7"],
  ["pt", "pt-PT,pt;q=0.9,en;q=0.7"],
  ["ro", "ro-RO,ro;q=0.9,en;q=0.7"],
  ["ru", "ru-RU,ru;q=0.9,en;q=0.7"],
  ["sa", "ar-SA,ar;q=0.9,en;q=0.7"],
  ["se", "sv-SE,sv;q=0.9,en;q=0.7"],
  ["si", "sl-SI,sl;q=0.9,en;q=0.7"],
  ["sk", "sk-SK,sk;q=0.9,en;q=0.7"],
  ["th", "th-TH,th;q=0.9,en;q=0.7"],
  ["tr", "tr-TR,tr;q=0.9,en;q=0.7"],
  ["tw", "zh-TW,zh;q=0.9,en;q=0.7"],
  ["ua", "uk-UA,uk;q=0.9,ru;q=0.8,en;q=0.7"],
  ["uk", "en-GB,en;q=0.9"],
  ["vn", "vi-VN,vi;q=0.9,en;q=0.7"],
  ["za", "en-ZA,en;q=0.9"]
]);

/**
 * Extracts the value of the HTTP `Location` response header from a header array.
 * Comparison is case-insensitive to match RFC 7230 requirements.
 *
 * @param {browser.webRequest.HttpHeader[]} [headers=[]] Array of response headers.
 * @returns {string} The Location header value, or "" if absent or malformed.
 */
const readLocationHeader = (headers = []) => {
  const locationHeader = headers.find(
    (header) => header && typeof header.name === "string" && header.name.toLowerCase() === "location"
  );

  return locationHeader && typeof locationHeader.value === "string" ? locationHeader.value : "";
};

/**
 * Returns true if the hostname is a local or non-routable address that should
 * not have its Accept-Language header modified.
 * Covers: localhost, .local TLD, unspecified/loopback/private/link-local IPv4,
 * unspecified (::)/loopback/link-local/unique-local (ULA, fc00::/7) IPv6.
 * @param {string} hostname Hostname to test.
 * @returns {boolean}
 */
const isNonRoutableHost = (hostname) => {
  if (!hostname) return false;
  const h = hostname.toLowerCase();

  if (h === "localhost" || h.endsWith(".local")) return true;

  if (IPV4_REGEX.test(h)) {
    const parts = h.split(".").map(Number);
    return (
      parts[0] === 0 ||
      parts[0] === 127 ||
      parts[0] === 10 ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 169 && parts[1] === 254)
    );
  }

  if (IPV6_REGEX.test(h)) {
    const bare = stripIPv6Brackets(h);
    const firstHextet = bare.split(":")[0];

    const isUnspecified = bare === "::";
    const isLoopback = bare === "::1";

    let isLinkLocal = false;
    if (firstHextet && firstHextet.startsWith("fe")) {
      const hextetValue = parseInt(firstHextet, 16);
      if (!Number.isNaN(hextetValue) && hextetValue >= 0xfe80 && hextetValue <= 0xfebf) {
        isLinkLocal = true;
      }
    }

    const isUla = bare.startsWith("fc") || bare.startsWith("fd");

    return isUnspecified || isLoopback || isLinkLocal || isUla;
  }

  return false;
};

/**
 * Builds the spoofed Accept-Language header value for a given hostname.
 * Extracts the TLD from the hostname and looks it up in ACCEPT_LANGUAGE_BY_TLD.
 * Falls back to DEFAULT_ACCEPT_LANGUAGE for IP addresses (IPv4 and IPv6),
 * single-label hostnames, and TLDs not present in the map (e.g. .io, .dev, .app).
 *
 * @param {string} hostname The request hostname (e.g. "www.example.fr").
 * @returns {string} RFC 4647 Accept-Language value (e.g. "fr-FR,fr;q=0.9,en;q=0.7"),
 *   or DEFAULT_ACCEPT_LANGUAGE when no TLD mapping is found.
 *
 * @example
 * buildAcceptLanguage("shop.example.de") // → "de-DE,de;q=0.9,en;q=0.7"
 * buildAcceptLanguage("app.example.io")  // → "en-US,en;q=0.9" (unknown TLD fallback)
 * buildAcceptLanguage("192.168.1.1")     // → "en-US,en;q=0.9" (IPv4 fallback)
 * buildAcceptLanguage("[::1]")           // → "en-US,en;q=0.9" (bracketed IPv6 fallback)
 * buildAcceptLanguage("::1")             // → "en-US,en;q=0.9" (bare IPv6 fallback)
 */
const buildAcceptLanguage = (hostname) => {
  if (IPV4_REGEX.test(hostname) || IPV6_REGEX.test(hostname)) {
    return DEFAULT_ACCEPT_LANGUAGE;
  }

  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  const tld = labels[labels.length - 1] || "";
  return ACCEPT_LANGUAGE_BY_TLD.get(tld) || DEFAULT_ACCEPT_LANGUAGE;
};

const cleanupStaleTrackedRequests = (now = Date.now()) => {
  for (const [requestId, trackedRequest] of initialHostByRequest.entries()) {
    if (trackedRequest && typeof trackedRequest === "object" && now - trackedRequest.trackedAt > REQUEST_TRACK_TTL_MS) {
      initialHostByRequest.delete(requestId);
      redirectedRequestIds.delete(requestId);
    }
  }
};

/**
 * Records the initial hostname for a given request ID to allow cross-redirect
 * domain comparison in onHeadersReceived.
 *
 * When the map reaches MAX_TRACKED_REQUESTS, eviction first delegates to
 * {@link cleanupStaleTrackedRequests} to bulk-remove TTL-expired entries.
 * Falls back to evicting the oldest-inserted entry only when no stale entry
 * exists, bounding memory usage.
 *
 * @param {string} requestId The WebExtensions request identifier.
 * @param {string} host      The hostname from the original request URL.
 */
const trackInitialHost = (requestId, host) => {
  if (initialHostByRequest.size >= MAX_TRACKED_REQUESTS) {
    const now = Date.now();
    cleanupStaleTrackedRequests(now);
    if (initialHostByRequest.size >= MAX_TRACKED_REQUESTS) {
      const evictKey = initialHostByRequest.keys().next().value;
      initialHostByRequest.delete(evictKey);
      redirectedRequestIds.delete(evictKey);
    }
  }

  initialHostByRequest.set(requestId, { host, trackedAt: Date.now() });
};

/**
 * Rebuilds the in-memory {@link exceptionDomains} set from the provided list.
 * Called at extension startup and whenever `storage.onChanged` fires for
 * {@link STORAGE_KEY}. Entries that are not non-empty strings are silently
 * ignored; all retained values are trimmed and lowercased.
 *
 * @param {string[]} [domains=[]] Array of domain strings from `browser.storage.sync`.
 */
const updateExceptionDomains = (domains = []) => {
  exceptionDomains.clear();
  domains
    .filter((domain) => typeof domain === "string" && domain.trim())
    .forEach((domain) => exceptionDomains.add(domain.trim().toLowerCase()));
};

/* istanbul ignore next */
if (typeof module === "undefined") {
  const CLEANUP_INTERVAL_KEY = "__acceptLangExt_cleanupIntervalId";
  const existingCleanupIntervalId = globalThis[CLEANUP_INTERVAL_KEY];
  if (typeof existingCleanupIntervalId === "number" || typeof existingCleanupIntervalId === "object") {
    clearInterval(existingCleanupIntervalId);
  }
  globalThis[CLEANUP_INTERVAL_KEY] = setInterval(cleanupStaleTrackedRequests, REQUEST_TRACK_TTL_MS);

  browser.storage.sync
    .get(STORAGE_KEY)
    .then((stored) => {
      const data = stored[STORAGE_KEY];
      updateExceptionDomains(Array.isArray(data) ? data : []);
    })
    .catch((error) => {
      console.error("Failed to load exception domains", error);
      updateExceptionDomains();
    });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync" && changes[STORAGE_KEY]) {
      const updatedDomains = changes[STORAGE_KEY].newValue;
      updateExceptionDomains(Array.isArray(updatedDomains) ? updatedDomains : []);
    }
  });

  browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.type !== "main_frame") {
      return;
    }

    if (!details.url.startsWith("http://") && !details.url.startsWith("https://")) {
      return;
    }

    try {
      const currentHost = new URL(details.url).hostname;
      if (!initialHostByRequest.has(details.requestId)) {
        trackInitialHost(details.requestId, currentHost);
      } else {
        // The requestId is already tracked, meaning the browser is following a
        // same-TLD redirect within this request lifecycle. Mark it so that
        // onBeforeSendHeaders will apply the Accept-Language override.
        redirectedRequestIds.add(details.requestId);
      }
    } catch (_error) {
      initialHostByRequest.delete(details.requestId);
      redirectedRequestIds.delete(details.requestId);
    }
  },
  { urls: ["<all_urls>"], types: ["main_frame"] }
  );

  browser.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (details.type !== "main_frame") {
      return {};
    }

    if (!details.url.startsWith("http://") && !details.url.startsWith("https://")) {
      return {};
    }

    // Only override Accept-Language when a redirect has already been observed
    // for this request. Initial page loads use the browser's real locale to
    // avoid disclosing TLD navigation intent to every visited site.
    if (!redirectedRequestIds.has(details.requestId)) {
      return {};
    }

    let host = "";
    try {
      host = new URL(details.url).hostname;

      if (isNonRoutableHost(host)) {
        return {};
      }

      if (!Array.isArray(details.requestHeaders)) {
        return {};
      }

      const requestHeaders = details.requestHeaders;
      const spoofedLanguage = buildAcceptLanguage(host);
      let acceptLanguageHeaderIndex = -1;
      for (let i = 0; i < requestHeaders.length; i++) {
        const header = requestHeaders[i];
        if (header && typeof header.name === "string" && header.name.toLowerCase() === "accept-language") {
          acceptLanguageHeaderIndex = i;
          break;
        }
      }

      if (acceptLanguageHeaderIndex !== -1) {
        requestHeaders[acceptLanguageHeaderIndex].value = spoofedLanguage;
      } else {
        requestHeaders.push({ name: "Accept-Language", value: spoofedLanguage });
      }

      return { requestHeaders };
    } catch (error) {
      console.warn("Failed to adjust Accept-Language header for host", host, error);
      return {};
    }
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["blocking", "requestHeaders"]
  );

  browser.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.type !== "main_frame") {
      return {};
    }

    if (!details.url.startsWith("http://") && !details.url.startsWith("https://")) {
      return {};
    }

    if (![301, 302, 303, 307, 308].includes(details.statusCode)) {
      cleanupTrackedRequest(details.requestId);
      return {};
    }

    const redirectLocation = readLocationHeader(details.responseHeaders);
    if (!redirectLocation) {
      return {};
    }

    let parsedRedirect;
    try {
      parsedRedirect = new URL(redirectLocation, details.url);
    } catch (_error) {
      // Malformed redirect URL — cancel to be safe
      cleanupTrackedRequest(details.requestId);
      return { cancel: true };
    }

    // Reject non-HTTP(S) redirect targets unconditionally (data:, blob:, ftp:, etc.)
    if (parsedRedirect.protocol !== "http:" && parsedRedirect.protocol !== "https:") {
      cleanupTrackedRequest(details.requestId);
      return { cancel: true };
    }

    const redirectHost = parsedRedirect.hostname;

    try {
      const trackedRequest = initialHostByRequest.get(details.requestId);
      const initialHost =
        (trackedRequest && typeof trackedRequest === "object" ? trackedRequest.host : trackedRequest) ||
        new URL(details.url).hostname;
      if (exceptionDomains.has(getRootDomain(initialHost)) ||
          exceptionDomains.has(getRootDomain(redirectHost))) {
        // Keep tracking state so onBeforeRequest marks the subsequent
        // redirected request in redirectedRequestIds, enabling Accept-Language spoofing.
        return {};
      }
      if (getRootDomain(initialHost) !== getRootDomain(redirectHost)) {
        cleanupTrackedRequest(details.requestId);
        return { cancel: true };
      }
    } catch (error) {
      console.warn(
        "Failed to resolve initial host during redirect handling in onHeadersReceived",
        details.url,
        `${parsedRedirect.origin}${parsedRedirect.pathname}`,
        error
      );
      const trackedRequest = initialHostByRequest.get(details.requestId);
      try {
        const initialHost =
          (trackedRequest && typeof trackedRequest === "object" ? trackedRequest.host : trackedRequest) ||
          new URL(details.url).hostname;
        if (!exceptionDomains.has(getRootDomain(initialHost))) {
          cleanupTrackedRequest(details.requestId);
          return { cancel: true };
        }
        // Exception domain: keep tracking state alive for Accept-Language spoofing on the redirect.
      } catch (cancelError) {
        console.warn("Failed to determine initial host during fail-closed redirect cancellation", details.url, cancelError);
        cleanupTrackedRequest(details.requestId);
        return { cancel: true };
      }
    }

    return {};
  },
  { urls: ["<all_urls>"], types: ["main_frame"] },
  ["blocking", "responseHeaders"]
  );

  browser.webRequest.onCompleted.addListener(
    (details) => {
      initialHostByRequest.delete(details.requestId);
      redirectedRequestIds.delete(details.requestId);
    },
    { urls: ["<all_urls>"], types: ["main_frame"] }
  );

  browser.webRequest.onErrorOccurred.addListener(
    (details) => {
      initialHostByRequest.delete(details.requestId);
      redirectedRequestIds.delete(details.requestId);
    },
    { urls: ["<all_urls>"], types: ["main_frame"] }
  );
}

/* istanbul ignore next */
if (typeof module === "object" && module !== null) {
  module.exports = {
    isNonRoutableHost,
    buildAcceptLanguage,
    DEFAULT_ACCEPT_LANGUAGE,
    trackInitialHost,
    cleanupStaleTrackedRequests,
    initialHostByRequest,
    redirectedRequestIds,
    REQUEST_TRACK_TTL_MS,
    MAX_TRACKED_REQUESTS,
  };
}
