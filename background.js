const initialHostByRequest = new Map();

const getRootDomain = (hostname) => {
  if (!hostname) {
    return "";
  }

  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  if (labels.length < 2) {
    return hostname.toLowerCase();
  }

  return `${labels[labels.length - 2]}.${labels[labels.length - 1]}`;
};

const readLocationHeader = (headers = []) => {
  const locationHeader = headers.find(
    (header) => header && typeof header.name === "string" && header.name.toLowerCase() === "location"
  );

  return locationHeader && typeof locationHeader.value === "string" ? locationHeader.value : "";
};

browser.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (details.type !== "main_frame") {
      return;
    }

    const currentHost = new URL(details.url).hostname;
    if (!initialHostByRequest.has(details.requestId)) {
      initialHostByRequest.set(details.requestId, currentHost);
    }
  },
  { urls: ["<all_urls>"], types: ["main_frame"] }
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

    const initialHost = initialHostByRequest.get(details.requestId) || new URL(details.url).hostname;
    const redirectLocation = readLocationHeader(details.responseHeaders);
    if (!redirectLocation) {
      return {};
    }

    const redirectHost = new URL(redirectLocation, details.url).hostname;
    if (getRootDomain(initialHost) !== getRootDomain(redirectHost)) {
      initialHostByRequest.delete(details.requestId);
      return { cancel: true };
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
