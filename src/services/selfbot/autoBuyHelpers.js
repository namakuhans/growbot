/**
 * Facade module re-exporting all auto-buy helper functionalities.
 * Provides backwards compatibility while keeping internal modules small and focused.
 */

const { stateMap, isAutoBuying } = require('./buyState');
const { isGamebotMessage, fetchLatestGamebotMessage, waitForGamebotWithKeywords } = require('./messageHelpers');
const { clickLockBuyAndSubmitModal, selectFarmableDropdownOption } = require('./modalHelpers');
const { startFarmingOnMainPanel, navigateToFarmingMenu, ensureReturnToMainPanel } = require('./navigation');

module.exports = {
  // State management
  stateMap,
  isAutoBuying,

  // Message discovery
  isGamebotMessage,
  fetchLatestGamebotMessage,
  waitForGamebotWithKeywords,

  // Modal & dropdown interactions
  clickLockBuyAndSubmitModal,
  selectFarmableDropdownOption,

  // Navigation & farming controls
  startFarmingOnMainPanel,
  navigateToFarmingMenu,
  ensureReturnToMainPanel
};
