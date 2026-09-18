const { sqliteDb, performBackup, ensureDb } = require('./connection');
const { getPanel, setPanel } = require('./models/panelModel');
const { getStats, incrementResolved } = require('./models/statsModel');
const {
  getSelfbots,
  getSelfbotsByUser,
  getSelfbotByToken,
  addOrUpdateSelfbot,
  updateSelfbotThread,
  updateSelfbotProxy,
  removeSelfbot,
  resetSelfbotsTable
} = require('./models/selfbotModel');
const {
  purgeInvalidUserDmPanels,
  getUserDmPanels,
  getUserDmPanel,
  setUserDmPanel,
  clearUserDmPanel,
  resetUserDmPanelsTable
} = require('./models/userDmPanelModel');
const {
  getLicenses,
  getUserLicense,
  setUserLicense,
  setUserLicensePermanent,
  removeUserLicense
} = require('./models/licenseModel');
const {
  addWhitelistedUser,
  removeWhitelistedUser,
  getWhitelistedUsers,
  isWhitelistedInDb,
  isWhitelistedUser,
  hasUserAccess
} = require('./models/whitelistModel');

function resetDatabase() {
  resetSelfbotsTable();
  resetUserDmPanelsTable();
}

module.exports = {
  sqliteDb,
  ensureDb,
  getPanel,
  setPanel,
  getStats,
  incrementResolved,
  getSelfbots,
  getSelfbotsByUser,
  getSelfbotByToken,
  addOrUpdateSelfbot,
  updateSelfbotThread,
  updateSelfbotProxy,
  removeSelfbot,
  getUserDmPanels,
  getUserDmPanel,
  setUserDmPanel,
  clearUserDmPanel,
  resetDatabase,
  getLicenses,
  getUserLicense,
  setUserLicense,
  setUserLicensePermanent,
  removeUserLicense,
  addWhitelistedUser,
  removeWhitelistedUser,
  getWhitelistedUsers,
  isWhitelistedInDb,
  isWhitelistedUser,
  hasUserAccess,
  performBackup
};
