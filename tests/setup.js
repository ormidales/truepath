/**
 * Jest global setup: provides a minimal `browser` extension API stub so that
 * background.js can be loaded in a Node.js/Jest environment without the
 * WebExtension runtime.  Also exports the shared constants from utils.js into
 * `global` so that background.js can access them the same way it would in the
 * browser (where both scripts are loaded in the same page context via manifest).
 */

// Expose utils.js constants as globals so background.js can reference them.
const utils = require("../utils.js");
global.IPV4_REGEX = utils.IPV4_REGEX;
global.IPV6_REGEX = utils.IPV6_REGEX;
global.stripIPv6Brackets = utils.stripIPv6Brackets;
global.getRootDomain = utils.getRootDomain;

const mockListener = { addListener: jest.fn() };

global.browser = {
  storage: {
    sync: {
      get: jest.fn().mockResolvedValue({}),
      set: jest.fn().mockResolvedValue(undefined),
    },
    onChanged: mockListener,
  },
  webRequest: {
    onBeforeRequest: mockListener,
    onBeforeSendHeaders: mockListener,
    onHeadersReceived: mockListener,
    onCompleted: mockListener,
    onErrorOccurred: mockListener,
  },
  runtime: {
    onMessage: mockListener,
  },
};
