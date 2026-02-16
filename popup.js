const STORAGE_KEY = "exceptionDomains";
let currentDomain = "";
let isAddingDomain = false;

const getStoredDomains = async () => {
  const stored = await browser.storage.sync.get(STORAGE_KEY);
  return Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
};

const setStatus = (message) => {
  document.getElementById("status").textContent = message;
};

const renderList = async () => {
  const domains = await getStoredDomains();
  const sortedDomains = [...domains].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  const list = document.getElementById("domain-list");
  list.textContent = "";

  if (domains.length === 0) {
    const emptyItem = document.createElement("li");
    emptyItem.className = "empty-state";
    emptyItem.textContent = "Aucun domaine en liste blanche";
    list.appendChild(emptyItem);
    return;
  }

  sortedDomains.forEach((domain) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = domain;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = "Supprimer";
    removeButton.setAttribute("aria-label", `Supprimer le domaine ${domain}`);
    removeButton.addEventListener("click", async () => {
      const buttons = Array.from(list.querySelectorAll("li button"));
      const buttonIndex = buttons.indexOf(removeButton);
      const nextFocusButton = buttons[buttonIndex + 1] || buttons[buttonIndex - 1] || null;

      item.remove();
      if (list.children.length === 0) {
        const emptyItem = document.createElement("li");
        emptyItem.className = "empty-state";
        emptyItem.textContent = "Aucun domaine en liste blanche";
        list.appendChild(emptyItem);
      } else if (nextFocusButton) {
        nextFocusButton.focus();
      }

      const currentDomains = await getStoredDomains();
      const nextDomains = currentDomains.filter((entry) => entry !== domain);
      await browser.storage.sync.set({ [STORAGE_KEY]: nextDomains });
    });

    item.appendChild(label);
    item.appendChild(removeButton);
    list.appendChild(item);
  });
};

const addCurrentDomain = async () => {
  if (isAddingDomain) {
    return;
  }

  isAddingDomain = true;
  const addButton = document.getElementById("add-domain");
  if (addButton) {
    addButton.disabled = true;
  }

  try {
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
  } finally {
    isAddingDomain = false;
    if (addButton) {
      addButton.disabled = false;
    }
  }
};

const clearDomains = async () => {
  const domains = await getStoredDomains();
  if (domains.length === 0) {
    setStatus("La liste blanche est déjà vide.");
    return;
  }

  if (!window.confirm("Voulez-vous vraiment vider la liste blanche ?")) {
    return;
  }

  await browser.storage.sync.set({ [STORAGE_KEY]: [] });
  setStatus("Liste blanche vidée.");
  await renderList();
};

const initPopup = async () => {
  if (typeof browser === "undefined" || !browser.tabs || !browser.storage) {
    setStatus("API WebExtensions indisponible.");
    return;
  }

  const addButton = document.getElementById("add-domain");
  const clearButton = document.getElementById("clear-domains");
  if (!addButton || !clearButton) {
    setStatus("Boutons d'action introuvables.");
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
  clearButton.addEventListener("click", clearDomains);
  await renderList();
};

document.addEventListener("DOMContentLoaded", () => {
  initPopup().catch((error) => {
    console.error("Popup initialization failed", error);
    setStatus("Erreur lors du chargement.");
  });
});
