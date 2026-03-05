const initialHostByRequest = new Map();
const MAX_TRACKED_REQUESTS = 1000;
const REQUEST_TRACK_TTL_MS = 60 * 1000;
const STORAGE_KEY = "exceptionDomains";
const exceptionDomains = new Set();
const DEFAULT_ACCEPT_LANGUAGE = "en-US,en;q=0.9";
const ACCEPT_LANGUAGE_BY_TLD = new Map([
  ["ar", "es-AR,es;q=0.9,en;q=0.7"],
  ["at", "de-AT,de;q=0.9,en;q=0.7"],
  ["au", "en-AU,en;q=0.9"],
  ["be", "nl-BE,nl;q=0.9,fr;q=0.8,en;q=0.7"],
  ["br", "pt-BR,pt;q=0.9,en;q=0.7"],
  ["ca", "en-CA,en;q=0.9,fr;q=0.8"],
  ["ch", "de-CH,de;q=0.9,fr;q=0.8,it;q=0.7,en;q=0.6"],
  ["cn", "zh-CN,zh;q=0.9,en;q=0.7"],
  ["cz", "cs-CZ,cs;q=0.9,en;q=0.7"],
  ["dk", "da-DK,da;q=0.9,en;q=0.7"],
  ["de", "de-DE,de;q=0.9,en;q=0.7"],
  ["es", "es-ES,es;q=0.9,en;q=0.7"],
  ["fi", "fi-FI,fi;q=0.9,en;q=0.7"],
  ["fr", "fr-FR,fr;q=0.9,en;q=0.7"],
  ["ie", "en-IE,en;q=0.9"],
  ["in", "en-IN,en;q=0.9,hi;q=0.8"],
  ["it", "it-IT,it;q=0.9,en;q=0.7"],
  ["jp", "ja-JP,ja;q=0.9,en;q=0.7"],
  ["kr", "ko-KR,ko;q=0.9,en;q=0.7"],
  ["mx", "es-MX,es;q=0.9,en;q=0.7"],
  ["nl", "nl-NL,nl;q=0.9,en;q=0.7"],
  ["no", "nb-NO,nn-NO,nb;q=0.9,nn;q=0.8,en;q=0.7"],
  ["nz", "en-NZ,en;q=0.9"],
  ["pl", "pl-PL,pl;q=0.9,en;q=0.7"],
  ["pt", "pt-PT,pt;q=0.9,en;q=0.7"],
  ["ru", "ru-RU,ru;q=0.9,en;q=0.7"],
  ["se", "sv-SE,sv;q=0.9,en;q=0.7"],
  ["tr", "tr-TR,tr;q=0.9,en;q=0.7"],
  ["tw", "zh-TW,zh;q=0.9,en;q=0.7"],
  ["uk", "en-GB,en;q=0.9"],
  ["za", "en-ZA,en;q=0.9"]
]);

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
 * loopback/link-local/unique-local (ULA, fc00::/7) IPv6.
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
    const bare = h.replace(/^\[|\]$/g, "").split("%")[0].toLowerCase();
    return bare === "::1" || bare.startsWith("fe80:") || bare.startsWith("fc") || bare.startsWith("fd");
  }

  return false;
};

/**
 * Builds the spoofed Accept-Language value from a request hostname.
 * @param {string} hostname Hostname used to infer a TLD-specific language profile.
 * @returns {string} Spoofed Accept-Language header value, with default fallback for IPs/unknown TLDs.
 */
const buildAcceptLanguage = (hostname) => {
  if (IPV4_REGEX.test(hostname) || IPV6_REGEX.test(hostname)) {
    return DEFAULT_ACCEPT_LANGUAGE;
  }

  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  const tld = labels[labels.length - 1] || "";
  return ACCEPT_LANGUAGE_BY_TLD.get(tld) || DEFAULT_ACCEPT_LANGUAGE;
};

const trackInitialHost = (requestId, host) => {
  if (initialHostByRequest.size >= MAX_TRACKED_REQUESTS) {
    const firstKey = initialHostByRequest.keys().next().value;
    initialHostByRequest.delete(firstKey);
  }

  initialHostByRequest.set(requestId, { host, trackedAt: Date.now() });
};

const cleanupStaleTrackedRequests = (now = Date.now()) => {
  for (const [requestId, trackedRequest] of initialHostByRequest.entries()) {
    if (trackedRequest && typeof trackedRequest === "object" && now - trackedRequest.trackedAt > REQUEST_TRACK_TTL_MS) {
      initialHostByRequest.delete(requestId);
    }
  }
};

setInterval(cleanupStaleTrackedRequests, REQUEST_TRACK_TTL_MS);

const updateExceptionDomains = (domains = []) => {
  exceptionDomains.clear();
  domains
    .filter((domain) => typeof domain === "string" && domain.trim())
    .forEach((domain) => exceptionDomains.add(domain.trim().toLowerCase()));
};

browser.storage.sync
  .get(STORAGE_KEY)
  .then((stored) => updateExceptionDomains(stored[STORAGE_KEY]))
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
      }
    } catch (_error) {
      initialHostByRequest.delete(details.requestId);
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

    let host = "";
    try {
      host = new URL(details.url).hostname;
      if (exceptionDomains.has(getRootDomain(host))) {
        return {};
      }

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
      initialHostByRequest.delete(details.requestId);
      return {};
    }

    const redirectLocation = readLocationHeader(details.responseHeaders);
    if (!redirectLocation) {
      return {};
    }

    try {
      const trackedRequest = initialHostByRequest.get(details.requestId);
      const initialHost =
        (trackedRequest && typeof trackedRequest === "object" ? trackedRequest.host : trackedRequest) ||
        new URL(details.url).hostname;
      const redirectHost = new URL(redirectLocation, details.url).hostname;
      if (exceptionDomains.has(getRootDomain(initialHost))) {
        initialHostByRequest.delete(details.requestId);
        return {};
      }
      if (getRootDomain(initialHost) !== getRootDomain(redirectHost)) {
        initialHostByRequest.delete(details.requestId);
        return { cancel: true };
      }
    } catch (error) {
      let safeRedirectLocation = redirectLocation;
      try {
        const parsedRedirect = new URL(redirectLocation, details.url);
        safeRedirectLocation = parsedRedirect.origin + parsedRedirect.pathname;
      } catch (_e) {
        // URL is malformed; fall back to the raw value already assigned above
      }
      console.warn(
        "Failed to parse redirect URL in onHeadersReceived",
        details.url,
        safeRedirectLocation,
        error
      );
      const trackedRequest = initialHostByRequest.get(details.requestId);
      initialHostByRequest.delete(details.requestId);
      try {
        const initialHost =
          (trackedRequest && typeof trackedRequest === "object" ? trackedRequest.host : trackedRequest) ||
          new URL(details.url).hostname;
        if (!exceptionDomains.has(getRootDomain(initialHost))) {
          return { cancel: true };
        }
      } catch (cancelError) {
        console.warn("Failed to determine initial host during fail-closed redirect cancellation", details.url, cancelError);
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
  },
  { urls: ["<all_urls>"], types: ["main_frame"] }
);

browser.webRequest.onErrorOccurred.addListener(
  (details) => {
    initialHostByRequest.delete(details.requestId);
  },
  { urls: ["<all_urls>"], types: ["main_frame"] }
);
