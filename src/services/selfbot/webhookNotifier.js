const { EmbedBuilder, WebhookClient } = require('discord.js');
const db = require('../../database/db');
const { getDynamicFooterText } = require('../../config/constants');

// Track notified state per token to ensure webhook notification is sent ONCE per invalid thread incident
const notifiedInvalidTokens = new Set();

/**
 * Sends a Discord Webhook notification when a selfbot thread becomes invalid or is deleted.
 *
 * @param {Client} selfClient - The selfbot client instance
 * @param {string} token - The selfbot token
 * @param {string} threadId - The invalid/deleted thread ID
 * @param {string} userId - The owner user ID
 */
async function notifyInvalidThreadWebhook(selfClient, token, threadId, userId) {
  if (notifiedInvalidTokens.has(token)) {
    return;
  }

  // Mark token as notified for this incident
  notifiedInvalidTokens.add(token);

  try {
    const sbData = db.getSelfbotByToken(token);
    const webhookUrl = sbData?.webhookUrl;

    if (!webhookUrl) {
      console.log(`[WEBHOOK NOTIFIER] ${selfClient.user?.tag || 'Selfbot'}: Thread <#${threadId}> invalid, but no webhook URL configured. Skipping notification.`);
      return;
    }

    const webhookClient = new WebhookClient({ url: webhookUrl });

    const pfpUrl = selfClient.user?.displayAvatarURL({ dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
    const selfTag = selfClient.user?.tag || selfClient.user?.username || sbData?.displayName || 'Selfbot Account';
    const timestampSec = Math.floor(Date.now() / 1000);

    const embed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('🔴 Selfbot Thread Invalid / Terhapus!')
      .setDescription('Thread target AFK farming terdeteksi invalid atau telah terhapus. Selfbot berada dalam posisi **idle** dan melewati siklus farming hingga Thread ID diperbarui.')
      .setThumbnail(pfpUrl)
      .addFields(
        { name: 'Akun Selfbot', value: `\`${selfTag}\``, inline: true },
        { name: 'Waktu Kejadian', value: `<t:${timestampSec}:F>`, inline: true },
        { name: 'User Pemilik', value: `<@${userId}>`, inline: true }
      )
      .setFooter({ text: getDynamicFooterText() })
      .setTimestamp();

    await webhookClient.send({
      content: `<@${userId}>`,
      embeds: [embed]
    });

    console.log(`[WEBHOOK NOTIFIER] ${selfClient.user?.tag || 'Selfbot'}: Sent invalid thread notification to webhook for user ${userId}.`);
  } catch (err) {
    console.error(`[WEBHOOK NOTIFIER ERROR] ${selfClient.user?.tag || 'Selfbot'}:`, err.message);
  }
}

/**
 * Resets the invalid notification state for a token (e.g. when thread ID is updated).
 *
 * @param {string} token
 */
function resetInvalidThreadNotification(token) {
  notifiedInvalidTokens.delete(token);
}

module.exports = {
  notifyInvalidThreadWebhook,
  resetInvalidThreadNotification,
  notifiedInvalidTokens
};
