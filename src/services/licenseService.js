const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
const db = require('../database/db');
const { stopSelfbot } = require('./selfbotService');
const { sendOrUpdateUserDM } = require('./dmService');
const { updateActivePanel, updateMainBotRPC } = require('./panelService');
const { getDynamicFooterText } = require('../config/constants');

async function checkAndCleanExpiredLicenses(client) {
  try {
    const licenses = db.getLicenses();
    const now = Date.now();
    let hasChanges = false;

    for (const [userId, license] of Object.entries(licenses)) {
      // Check if user is whitelisted
      if (db.isWhitelistedUser(userId, null)) continue;

      if (license.expiresAt && license.expiresAt <= now) {
        console.log(`[LICENSE EXPIRED] License for user ${userId} has expired. Deleting selfbots...`);

        // Get user's selfbots
        const userSelfbots = db.getSelfbotsByUser(userId);

        // Stop and remove each selfbot
        for (const sb of userSelfbots) {
          stopSelfbot(sb.token);
          db.removeSelfbot(sb.token);
        }

        // Remove expired license record
        db.removeUserLicense(userId);
        hasChanges = true;

        // Notify user via DM with ComponentV2 message
        if (client) {
          try {
            const user = await client.users.fetch(userId).catch(() => null);
            if (user) {
              const expContainer = new ContainerBuilder()
                .setAccentColor(0xFF0000)
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent('# ⚠️ License Expired\nYour tool license has expired. All active selfbots associated with your account have been automatically stopped and removed.')
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(getDynamicFooterText())
                );

              await user.send({ components: [expContainer], flags: MessageFlags.IsComponentsV2 || (1 << 15) }).catch(() => null);
              await sendOrUpdateUserDM(user, client);
            }
          } catch (userErr) {
            console.error(`Failed to send expired license DM to ${userId}:`, userErr);
          }
        }
      }
    }

    if (hasChanges && client) {
      await updateActivePanel(client);
      updateMainBotRPC(client);
    }
  } catch (err) {
    console.error('[LICENSE CHECK ERROR]', err);
  }
}

function startLicenseChecker(client, intervalMs = 30000) {
  // Initial check
  checkAndCleanExpiredLicenses(client);

  // Periodic interval
  return setInterval(() => {
    checkAndCleanExpiredLicenses(client);
  }, intervalMs);
}

module.exports = {
  checkAndCleanExpiredLicenses,
  startLicenseChecker
};
