const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6_REGEX =
  /^\[?(?:(?:[a-f0-9]{1,4}:){7}[a-f0-9]{1,4}|(?:[a-f0-9]{1,4}:){1,7}:|(?:[a-f0-9]{1,4}:){1,6}:[a-f0-9]{1,4}|(?:[a-f0-9]{1,4}:){1,5}(?::[a-f0-9]{1,4}){1,2}|(?:[a-f0-9]{1,4}:){1,4}(?::[a-f0-9]{1,4}){1,3}|(?:[a-f0-9]{1,4}:){1,3}(?::[a-f0-9]{1,4}){1,4}|(?:[a-f0-9]{1,4}:){1,2}(?::[a-f0-9]{1,4}){1,5}|[a-f0-9]{1,4}:(?:(?::[a-f0-9]{1,4}){1,6})|:(?:(?::[a-f0-9]{1,4}){1,7}|:))(?:%[\w.-]+)?\]?$/i;

/**
 * Returns the registerable root domain used for domain comparison checks.
 * @param {string} hostname Hostname to normalize and reduce to its root domain.
 * @returns {string} Normalized root domain, or an empty string when hostname is falsy.
 */
const getRootDomain = (hostname) => {
  if (!hostname) {
    return "";
  }

  if (IPV4_REGEX.test(hostname) || IPV6_REGEX.test(hostname)) {
    return hostname;
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
