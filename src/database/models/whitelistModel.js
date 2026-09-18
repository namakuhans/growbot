const { sqliteDb } = require('../connection');

function addWhitelistedUser(userId, addedBy) {
  const now = Date.now();
  sqliteDb.prepare(`
    INSERT INTO whitelisted_users (user_id, added_at, added_by)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      added_at = excluded.added_at,
      added_by = excluded.added_by
  `).run(userId, now, addedBy);
  return { userId, addedAt: now, addedBy };
}

function removeWhitelistedUser(userId) {
  sqliteDb.prepare('DELETE FROM whitelisted_users WHERE user_id = ?').run(userId);
}

function getWhitelistedUsers() {
  const rows = sqliteDb.prepare('SELECT user_id, added_at as addedAt, added_by as addedBy FROM whitelisted_users').all();
  return rows || [];
}

function isWhitelistedInDb(userId) {
  const row = sqliteDb.prepare('SELECT user_id FROM whitelisted_users WHERE user_id = ?').get(userId);
  return !!row;
}

function isWhitelistedUser(userId, member) {
  if (isWhitelistedInDb(userId)) return true;

  const envRoleId = process.env.ROLE_ID;
  if (envRoleId && member && member.roles && member.roles.cache) {
    if (member.roles.cache.has(envRoleId)) return true;
  }

  const envWhitelist = (process.env.WHITELISTED_USERS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (envWhitelist.includes(userId)) return true;

  if (member && member.permissions && member.permissions.has && member.permissions.has('Administrator')) {
    return true;
  }

  return false;
}

function hasUserAccess(userId, member) {
  if (isWhitelistedUser(userId, member)) return true;

  const { getUserLicense } = require('./licenseModel');
  const license = getUserLicense(userId);
  if (license && license.expiresAt > Date.now()) {
    return true;
  }

  return false;
}

module.exports = {
  addWhitelistedUser,
  removeWhitelistedUser,
  getWhitelistedUsers,
  isWhitelistedInDb,
  isWhitelistedUser,
  hasUserAccess
};
