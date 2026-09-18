const { sqliteDb } = require('../connection');

function getLicenses() {
  const rows = sqliteDb.prepare('SELECT user_id, expires_at, granted_at, granted_by, duration_days FROM licenses').all();
  const res = {};
  for (const r of rows) {
    res[r.user_id] = { expiresAt: r.expires_at, grantedAt: r.granted_at, grantedBy: r.granted_by, durationDays: r.duration_days };
  }
  return res;
}

function getUserLicense(userId) {
  const r = sqliteDb.prepare('SELECT expires_at, granted_at, granted_by, duration_days FROM licenses WHERE user_id = ?').get(userId);
  if (!r) return null;
  return { expiresAt: r.expires_at ?? null, grantedAt: r.granted_at, grantedBy: r.granted_by, durationDays: r.duration_days };
}

function setUserLicense(userId, days, grantedBy) {
  const now = Date.now();
  // days = 0 means permanent (no expiry)
  const expiresAt = days > 0 ? now + (days * 24 * 60 * 60 * 1000) : null;

  sqliteDb.prepare(`
    INSERT INTO licenses (user_id, expires_at, granted_at, granted_by, duration_days)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      expires_at = excluded.expires_at,
      granted_at = excluded.granted_at,
      granted_by = excluded.granted_by,
      duration_days = excluded.duration_days
  `).run(userId, expiresAt, now, grantedBy, days);
  return { expiresAt, grantedAt: now, grantedBy, durationDays: days };
}

/**
 * Grant a permanent license (no expiry) to a user.
 * Safe to call multiple times — idempotent.
 */
function setUserLicensePermanent(userId, grantedBy) {
  return setUserLicense(userId, 0, grantedBy);
}

function removeUserLicense(userId) {
  sqliteDb.prepare('DELETE FROM licenses WHERE user_id = ?').run(userId);
  sqliteDb.prepare('DELETE FROM user_dm_panels WHERE user_id = ?').run(userId);
  sqliteDb.prepare('DELETE FROM selfbots WHERE user_id = ?').run(userId);
}

module.exports = {
  getLicenses,
  getUserLicense,
  setUserLicense,
  setUserLicensePermanent,
  removeUserLicense
};
