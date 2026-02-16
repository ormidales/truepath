const STORAGE_KEY = "exceptionDomains";
let currentDomain = "";

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
    removeButton.setAttribute("aria-label", `Supprimer le domaine ${domain}`);
    removeButton.addEventListener("click", async () => {
      const currentDomains = await getStoredDomains();
      const nextDomains = currentDomains.filter((entry) => entry !== domain);
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

  const addButton = document.getElementById("add-domain");
  if (!addButton) {
    setStatus("Bouton d'action introuvable.");
    return;
  }

  let tab = null;
  try {
    [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  } catch (_error) {
    tab = null;
  }
  if (tab && tab.url) {
    try {
      currentDomain = getRootDomain(new URL(tab.url).hostname);
    } catch (_error) {
      currentDomain = "";
    }
  }

  if (currentDomain) {
    addButton.textContent = `Ajouter ${currentDomain}`;
    addButton.disabled = false;
  } else {
    addButton.textContent = "Domaine non détecté";
    addButton.disabled = true;
  }

  addButton.addEventListener("click", addCurrentDomain);
  await renderList();
};

document.addEventListener("DOMContentLoaded", () => {
  initPopup().catch((error) => {
    console.error("Popup initialization failed", error);
    setStatus("Erreur lors du chargement.");
  });
});
