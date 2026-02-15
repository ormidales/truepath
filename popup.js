const STORAGE_KEY = "exceptionDomains";
let currentDomain = "";

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

const getStoredDomains = async () => {
  const stored = await browser.storage.sync.get(STORAGE_KEY);
  return Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
};

const setStatus = (message) => {
  document.getElementById("status").textContent = message;
};

const renderList = async () => {
  const domains = await getStoredDomains();
  const list = document.getElementById("domain-list");
  list.textContent = "";

  domains.forEach((domain) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = domain;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Supprimer";
    removeButton.addEventListener("click", async () => {
      const nextDomains = domains.filter((entry) => entry !== domain);
      await browser.storage.sync.set({ [STORAGE_KEY]: nextDomains });
      await renderList();
    });

    item.appendChild(label);
    item.appendChild(removeButton);
    list.appendChild(item);
  });
};

const addCurrentDomain = async () => {
  if (!currentDomain) {
    setStatus("Aucun domaine détecté.");
    return;
  }

  const domains = await getStoredDomains();
  if (domains.includes(currentDomain)) {
    setStatus("Le domaine est déjà dans la liste blanche.");
    return;
  }

  await browser.storage.sync.set({ [STORAGE_KEY]: [...domains, currentDomain] });
  setStatus("Domaine ajouté à la liste blanche.");
  await renderList();
};

const initPopup = async () => {
  if (typeof browser === "undefined" || !browser.tabs || !browser.storage) {
    setStatus("API WebExtensions indisponible.");
    return;
  }

  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    currentDomain = getRootDomain(new URL(tab.url).hostname);
  }

  document.getElementById("add-domain").addEventListener("click", addCurrentDomain);
  await renderList();
};

document.addEventListener("DOMContentLoaded", () => {
  initPopup().catch(() => setStatus("Erreur lors du chargement."));
});
