const STORAGE_KEY = "exceptionDomains";
const ERROR_STATUS_COLOR = "#b00020";
let currentDomain = "";
let isAddingDomain = false;
let isRemoving = false;

const getStoredDomains = async () => {
  const stored = await browser.storage.sync.get(STORAGE_KEY);
  return Array.isArray(stored[STORAGE_KEY])
    ? stored[STORAGE_KEY]
        .filter((domain) => typeof domain === "string")
        .map((domain) => domain.trim().toLowerCase())
    : [];
};

const setStatus = (message, isError = false) => {
  const status = document.getElementById("status");
  status.textContent = message;
  status.style.color = isError ? ERROR_STATUS_COLOR : "";
};

const renderList = async () => {
  let domains;
  try {
    domains = await getStoredDomains();
  } catch (error) {
    console.error("Failed to retrieve stored domains", error);
    setStatus("Erreur lors de la récupération des domaines.", true);
    document.getElementById("domain-list").textContent = "";
    return;
  }
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
      if (isRemoving) return;
      isRemoving = true;
      const buttons = Array.from(list.querySelectorAll("li button"));
      const buttonIndex = buttons.indexOf(removeButton);
      buttons.forEach((b) => (b.disabled = true));

      try {
        item.remove();
        if (list.children.length === 0) {
          const emptyItem = document.createElement("li");
          emptyItem.className = "empty-state";
          emptyItem.textContent = "Aucun domaine en liste blanche";
          list.appendChild(emptyItem);
        }

        const currentDomains = await getStoredDomains();
        const nextDomains = currentDomains.filter((entry) => entry !== domain);
        await browser.storage.sync.set({ [STORAGE_KEY]: nextDomains });
      } finally {
        isRemoving = false;
        await renderList();
        const newButtons = Array.from(list.querySelectorAll("li button"));
        if (newButtons.length === 0) {
          document.getElementById("add-domain").focus();
        } else {
          newButtons[Math.min(buttonIndex, newButtons.length - 1)].focus();
        }
      }
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

    const normalizedCurrentDomain = currentDomain.toLowerCase();
    const domains = await getStoredDomains();
    if (domains.some((domain) => domain.toLowerCase() === normalizedCurrentDomain)) {
      setStatus("Le domaine est déjà dans la liste blanche.");
      return;
    }

    try {
      await browser.storage.sync.set({ [STORAGE_KEY]: [...domains, normalizedCurrentDomain] });
    } catch (error) {
      const errorMessage = typeof error?.message === "string" ? error.message : "";
      const isQuotaError = /quota/i.test(errorMessage);
      setStatus(
        isQuotaError
          ? "Impossible de sauvegarder : Quota atteint"
          : "Impossible de sauvegarder : Erreur de stockage",
        true
      );
      return;
    }
    setStatus("Domaine ajouté à la liste blanche.");
    await renderList();
  } finally {
    isAddingDomain = false;
    if (addButton) {
      addButton.disabled = false;
    }
    const statusElement = document.getElementById("status");
    if (statusElement) {
      if (!statusElement.hasAttribute("tabindex")) {
        statusElement.setAttribute("tabindex", "-1");
      }
      statusElement.focus();
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
  const addButton = document.getElementById("add-domain");
  if (addButton && !addButton.disabled) {
    addButton.focus();
  } else {
    const clearButton = document.getElementById("clear-domains");
    if (clearButton && !clearButton.disabled) {
      clearButton.focus();
    } else {
      const statusRegion = document.getElementById("status");
      if (statusRegion) {
        if (!statusRegion.hasAttribute("tabindex")) {
          statusRegion.setAttribute("tabindex", "-1");
        }
        statusRegion.focus();
      }
    }
  }
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
