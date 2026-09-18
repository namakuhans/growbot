const db = require('../database/db');

/**
 * Checks if a Discord member has the ROLE_ID from environment,
 * and if so, automatically grants them a permanent license.
 *
 * Safe to call on every interaction — idempotent (skips if already permanent).
 *
 * @param {GuildMember|null} member  - Discord.js GuildMember (may be null in DMs)
 * @param {string}           userId  - Discord user ID string
 * @returns {boolean} true if a permanent license was newly granted
 */
function autoGrantRoleLicense(member, userId) {
  const roleId = (process.env.ROLE_ID || '').trim();
  if (!roleId) return false;

  // Only applies to guild members (not DMs)
  if (!member || !member.roles || !member.roles.cache) return false;

  // Check if user has the required role
  if (!member.roles.cache.has(roleId)) return false;

  // Check if they already have a permanent license — skip if so
  const existing = db.getUserLicense(userId);
  if (existing && existing.expiresAt === null) return false;

  // Grant permanent license
  db.setUserLicensePermanent(userId, 'AUTO_ROLE');
  console.log(`[AUTO LICENSE] Granted permanent license to ${userId} (has ROLE_ID: ${roleId})`);
  return true;
}

/**
 * Determines whether a user has a permanent license via:
 * 1. Existing permanent DB license (expiresAt === null or durationDays === 0 or grantedBy === 'AUTO_ROLE')
 * 2. Whitelisted in DB or environment whitelist
 * 3. Discord guild member holding ROLE_ID or Administrator permissions
 *
 * @param {Client|null} discordClient
 * @param {string}      userId
 * @param {object|null} license
 * @returns {Promise<boolean>}
 */
async function isUserRolePermanent(discordClient, userId, license = null) {
  if (!userId) return false;

  const lic = license || db.getUserLicense(userId);
  if (lic && (lic.expiresAt === null || lic.durationDays === 0 || lic.grantedBy === 'AUTO_ROLE')) {
    return true;
  }

  if (db.isWhitelistedInDb(userId)) return true;

  const envWhitelist = (process.env.WHITELISTED_USERS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (envWhitelist.includes(userId)) return true;

  const roleId = (process.env.ROLE_ID || '').trim();
  if (discordClient && roleId) {
    try {
      for (const guild of discordClient.guilds.cache.values()) {
        try {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) {
            if (member.roles && member.roles.cache && member.roles.cache.has(roleId)) {
              if (!lic || lic.expiresAt !== null) {
                db.setUserLicensePermanent(userId, 'AUTO_ROLE');
              }
              return true;
            }
            if (member.permissions && member.permissions.has && member.permissions.has('Administrator')) {
              return true;
            }
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  return false;
}

module.exports = {
  autoGrantRoleLicense,
  isUserRolePermanent
};
