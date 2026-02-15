const initialHostByRequest = new Map();
const MAX_TRACKED_REQUESTS = 1000;
const STORAGE_KEY = "exceptionDomains";
const exceptionDomains = new Set();
const DEFAULT_ACCEPT_LANGUAGE = "en-US,en;q=0.9";
const ACCEPT_LANGUAGE_BY_TLD = new Map([
  ["de", "de-DE,de;q=0.9,en;q=0.7"],
  ["es", "es-ES,es;q=0.9,en;q=0.7"],
  ["fr", "fr-FR,fr;q=0.9,en;q=0.7"],
  ["it", "it-IT,it;q=0.9,en;q=0.7"],
  ["nl", "nl-NL,nl;q=0.9,en;q=0.7"],
  ["pt", "pt-PT,pt;q=0.9,en;q=0.7"]
]);

const getRootDomain = (hostname) => {
  if (!hostname) {
    return "";
  }

  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  if (labels.length < 2) {
    return hostname.toLowerCase();
  }

  const secondLevelSuffixes = new Set(["ac", "co", "com", "edu", "gov", "net", "org"]);
  const tld = labels[labels.length - 1];
  const secondLevel = labels[labels.length - 2];
  if (labels.length >= 3 && tld.length === 2 && secondLevelSuffixes.has(secondLevel)) {
    return `${labels[labels.length - 3]}.${secondLevel}.${tld}`;
  }

  return `${labels[labels.length - 2]}.${labels[labels.length - 1]}`;
};

const readLocationHeader = (headers = []) => {
  const locationHeader = headers.find(
    (header) => header && typeof header.name === "string" && header.name.toLowerCase() === "location"
  );

  return locationHeader && typeof locationHeader.value === "string" ? locationHeader.value : "";
};

const buildAcceptLanguage = (hostname) => {
  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  const tld = labels[labels.length - 1] || "";
  return ACCEPT_LANGUAGE_BY_TLD.get(tld) || DEFAULT_ACCEPT_LANGUAGE;
};

const trackInitialHost = (requestId, host) => {
  if (initialHostByRequest.size >= MAX_TRACKED_REQUESTS) {
    const firstKey = initialHostByRequest.keys().next().value;
    initialHostByRequest.delete(firstKey);
  }

  initialHostByRequest.set(requestId, host);
};

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
    updateExceptionDomains(changes[STORAGE_KEY].newValue);
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

    if (details.statusCode !== 301 && details.statusCode !== 302) {
      initialHostByRequest.delete(details.requestId);
      return {};
    }

    const redirectLocation = readLocationHeader(details.responseHeaders);
    if (!redirectLocation) {
      return {};
    }

    try {
      const initialHost = initialHostByRequest.get(details.requestId) || new URL(details.url).hostname;
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
