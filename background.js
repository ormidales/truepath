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
  ["no", "nb-NO,nb;q=0.9,en;q=0.7"],
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
const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6_REGEX =
  /^\[?(?:(?:[a-f0-9]{1,4}:){7}[a-f0-9]{1,4}|(?:[a-f0-9]{1,4}:){1,7}:|(?:[a-f0-9]{1,4}:){1,6}:[a-f0-9]{1,4}|(?:[a-f0-9]{1,4}:){1,5}(?::[a-f0-9]{1,4}){1,2}|(?:[a-f0-9]{1,4}:){1,4}(?::[a-f0-9]{1,4}){1,3}|(?:[a-f0-9]{1,4}:){1,3}(?::[a-f0-9]{1,4}){1,4}|(?:[a-f0-9]{1,4}:){1,2}(?::[a-f0-9]{1,4}){1,5}|[a-f0-9]{1,4}:(?:(?::[a-f0-9]{1,4}){1,6})|:(?:(?::[a-f0-9]{1,4}){1,7}|:))\]?$/i;

const readLocationHeader = (headers = []) => {
  const locationHeader = headers.find(
    (header) => header && typeof header.name === "string" && header.name.toLowerCase() === "location"
  );

  return locationHeader && typeof locationHeader.value === "string" ? locationHeader.value : "";
};

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

    let host = "";
    try {
      host = new URL(details.url).hostname;
      if (exceptionDomains.has(getRootDomain(host))) {
        return {};
      }

      if (!Array.isArray(details.requestHeaders)) {
        return {};
      }

      const requestHeaders = [...details.requestHeaders];
      const spoofedLanguage = buildAcceptLanguage(host);
      const acceptLanguageHeader = requestHeaders.find(
        (header) => header && typeof header.name === "string" && header.name.toLowerCase() === "accept-language"
      );

      if (acceptLanguageHeader) {
        acceptLanguageHeader.value = spoofedLanguage;
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
    } catch (_error) {
      initialHostByRequest.delete(details.requestId);
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
