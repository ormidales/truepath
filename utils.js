/**
 * Returns the registrable root domain used for domain comparison checks.
 * @param {string} hostname Hostname to normalize and reduce to its root domain.
 * @returns {string} Normalized root domain, or an empty string when hostname is falsy.
 */
const getRootDomain = (hostname) => {
  if (!hostname) {
    return "";
  }

  const labels = hostname.toLowerCase().split(".").filter(Boolean);
  if (labels.length < 2) {
    return hostname.toLowerCase();
  }

  const secondLevelSuffixes = new Set(["ac", "asso", "co", "com", "edu", "gov", "gouv", "net", "nom", "org"]);
  const tld = labels[labels.length - 1];
  const secondLevel = labels[labels.length - 2];
  if (labels.length >= 3 && tld.length === 2 && secondLevelSuffixes.has(secondLevel)) {
    return `${labels[labels.length - 3]}.${secondLevel}.${tld}`;
  }

  return `${labels[labels.length - 2]}.${labels[labels.length - 1]}`;
};
