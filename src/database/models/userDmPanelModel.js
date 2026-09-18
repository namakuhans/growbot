const { sqliteDb } = require('../connection');
const { isWhitelistedInDb } = require('./whitelistModel');
const { getUserLicense } = require('./licenseModel');

function purgeInvalidUserDmPanels() {
  const dmRows = sqliteDb.prepare('SELECT user_id FROM user_dm_panels').all();
  for (const r of dmRows) {
    const uid = r.user_id;
    // Check if user is whitelisted in DB or has an unexpired timed license
    const isDbWhitelisted = isWhitelistedInDb(uid);
    const envWhitelist = (process.env.WHITELISTED_USERS || '').split(',').map(s => s.trim()).filter(Boolean);
    const isEnvWhitelisted = envWhitelist.includes(uid);
    const lic = getUserLicense(uid);
    const hasValidLicense = lic && lic.expiresAt > Date.now();

    if (!isDbWhitelisted && !isEnvWhitelisted && !hasValidLicense) {
      sqliteDb.prepare('DELETE FROM user_dm_panels WHERE user_id = ?').run(uid);
      sqliteDb.prepare('DELETE FROM selfbots WHERE user_id = ?').run(uid);
    }
  }
}

function getUserDmPanels() {
  purgeInvalidUserDmPanels();
  const rows = sqliteDb.prepare('SELECT user_id, channel_id as channelId, message_id as messageId FROM user_dm_panels').all();
  const res = {};
  for (const r of rows) {
    res[r.user_id] = { channelId: r.channelId, messageId: r.messageId };
  }
  return res;
}

function getUserDmPanel(userId) {
  const row = sqliteDb.prepare('SELECT channel_id as channelId, message_id as messageId FROM user_dm_panels WHERE user_id = ?').get(userId);
  return row || null;
}

function setUserDmPanel(userId, channelId, messageId) {
  sqliteDb.prepare(`
    INSERT INTO user_dm_panels (user_id, channel_id, message_id)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      channel_id = excluded.channel_id,
      message_id = excluded.message_id
  `).run(userId, channelId, messageId);
}

function clearUserDmPanel(userId) {
  sqliteDb.prepare('DELETE FROM user_dm_panels WHERE user_id = ?').run(userId);
}

function resetUserDmPanelsTable() {
  sqliteDb.prepare('DELETE FROM user_dm_panels').run();
}

module.exports = {
  purgeInvalidUserDmPanels,
  getUserDmPanels,
  getUserDmPanel,
  setUserDmPanel,
  clearUserDmPanel,
  resetUserDmPanelsTable
};
