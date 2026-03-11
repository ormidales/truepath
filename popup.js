const STORAGE_KEY = "exceptionDomains";
const CLEAR_CONFIRM_TIMEOUT_MS = 5000;
let currentDomain = "";
let isAddingDomain = false;
let isRemoving = false;
let isClearConfirming = false;
let clearConfirmTimeoutId = null;

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
  status.className = isError ? "status-error" : "status-success";
};

const renderList = async () => {
  let domains;
  try {
    domains = await getStoredDomains();
  } catch (error) {
    console.error("Failed to retrieve stored domains", error);
    setStatus(browser.i18n.getMessage("statusFetchError"), true);
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
    emptyItem.textContent = browser.i18n.getMessage("emptyState");
    list.appendChild(emptyItem);
    return;
  }

  sortedDomains.forEach((domain) => {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = domain;

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.textContent = browser.i18n.getMessage("btnRemoveDomain");
    removeButton.setAttribute("aria-label", browser.i18n.getMessage("ariaRemoveDomain", [domain]));
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
          emptyItem.textContent = browser.i18n.getMessage("emptyState");
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
      setStatus(browser.i18n.getMessage("statusNoDomain"));
      return;
    }

    const normalizedCurrentDomain = currentDomain.toLowerCase();
    const domains = await getStoredDomains();
    if (domains.some((domain) => domain.toLowerCase() === normalizedCurrentDomain)) {
      setStatus(browser.i18n.getMessage("statusAlreadyAdded"));
      return;
    }

    try {
      await browser.storage.sync.set({ [STORAGE_KEY]: [...domains, normalizedCurrentDomain] });
    } catch (error) {
      const errorMessage = typeof error?.message === "string" ? error.message : "";
      const isQuotaError = /quota/i.test(errorMessage);
      setStatus(
        isQuotaError
          ? browser.i18n.getMessage("statusQuotaError")
          : browser.i18n.getMessage("statusStorageError"),
        true
      );
      return;
    }
    setStatus(browser.i18n.getMessage("statusAdded"));
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

const resetClearConfirm = () => {
  isClearConfirming = false;
  if (clearConfirmTimeoutId !== null) {
    clearTimeout(clearConfirmTimeoutId);
    clearConfirmTimeoutId = null;
  }
  const clearButton = document.getElementById("clear-domains");
  if (clearButton) {
    clearButton.textContent = browser.i18n.getMessage("btnClearList");
    delete clearButton.dataset.confirming;
  }
  const cancelButton = document.getElementById("clear-cancel");
  if (cancelButton) {
    cancelButton.hidden = true;
  }
};

const clearDomains = async () => {
  const domains = await getStoredDomains();
  if (domains.length === 0) {
    resetClearConfirm();
    setStatus(browser.i18n.getMessage("statusListAlreadyEmpty"));
    return;
  }

  const clearButton = document.getElementById("clear-domains");

  if (!isClearConfirming) {
    isClearConfirming = true;
    if (clearButton) {
      clearButton.textContent = browser.i18n.getMessage("btnClearListConfirm");
      clearButton.dataset.confirming = "true";
    }
    const cancelButton = document.getElementById("clear-cancel");
    if (cancelButton) {
      cancelButton.hidden = false;
    }
    clearConfirmTimeoutId = setTimeout(resetClearConfirm, CLEAR_CONFIRM_TIMEOUT_MS);
    return;
  }

  resetClearConfirm();
  await browser.storage.sync.set({ [STORAGE_KEY]: [] });
  setStatus(browser.i18n.getMessage("statusListCleared"));
  await renderList();
  const addButton = document.getElementById("add-domain");
  if (addButton && !addButton.disabled) {
    addButton.focus();
  } else {
    const clearBtn = document.getElementById("clear-domains");
    if (clearBtn && !clearBtn.disabled) {
      clearBtn.focus();
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
    setStatus(browser?.i18n?.getMessage("statusApiUnavailable") ?? "WebExtensions API unavailable.");
    return;
  }

  const addButton = document.getElementById("add-domain");
  const clearButton = document.getElementById("clear-domains");
  const cancelButton = document.getElementById("clear-cancel");
  if (!addButton || !clearButton) {
    setStatus(browser.i18n.getMessage("statusButtonsNotFound"));
    return;
  }

  const loadingItem = document.querySelector("#domain-list li.empty-state");
  if (loadingItem) {
    loadingItem.textContent = browser.i18n.getMessage("statusLoading");
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

  const heading = document.querySelector("h1");
  if (heading) {
    heading.textContent = browser.i18n.getMessage("labelWhitelist");
  }
  clearButton.textContent = browser.i18n.getMessage("btnClearList");
  if (cancelButton) {
    cancelButton.textContent = browser.i18n.getMessage("btnCancelClear");
    cancelButton.addEventListener("click", resetClearConfirm);
  }

  if (currentDomain) {
    addButton.textContent = browser.i18n.getMessage("btnAddDomain", [currentDomain]);
    addButton.disabled = false;
  } else {
    addButton.textContent = browser.i18n.getMessage("btnDomainNotDetected");
    addButton.disabled = true;
  }

  addButton.addEventListener("click", addCurrentDomain);
  clearButton.addEventListener("click", clearDomains);
  await renderList();
};

document.addEventListener("DOMContentLoaded", () => {
  initPopup().catch((error) => {
    console.error("Popup initialization failed", error);
    setStatus(browser.i18n.getMessage("statusLoadError"));
  });
});
