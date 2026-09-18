const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../database/db');
const { stopSelfbot } = require('../services/selfbotService');
const { sendOrUpdateUserDM } = require('../services/dmService');
const { updateActivePanel, updateMainBotRPC } = require('../services/panelService');
const { getDynamicFooterText } = require('../config/constants');

const unlicenseCommand = new SlashCommandBuilder()
  .setName('unlicense')
  .setDescription('Revoke tool license from a user')
  .addUserOption(opt =>
    opt.setName('user')
      .setDescription('Target user to revoke license from')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleUnlicenseCommand(interaction) {
  // Check if execution user is whitelisted / admin
  if (!db.isWhitelistedUser(interaction.user.id, interaction.member)) {
    await interaction.reply({
      content: '❌ You are not authorized to use the `/unlicense` command.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUser = interaction.options.getUser('user');

  // Check if user has license or active selfbots
  const existingLicense = db.getUserLicense(targetUser.id);
  const userSelfbots = db.getSelfbotsByUser(targetUser.id);

  if (!existingLicense && userSelfbots.length === 0) {
    await interaction.editReply({
      content: `⚠️ <@${targetUser.id}> does not have an active license or registered selfbots.`
    });
    return;
  }

  // Remove license from DB
  db.removeUserLicense(targetUser.id);

  // Stop and remove all selfbots owned by this user
  for (const sb of userSelfbots) {
    stopSelfbot(sb.token);
    db.removeSelfbot(sb.token);
  }

  // Update control panel and main bot RPC
  await updateActivePanel(interaction.client);
  updateMainBotRPC(interaction.client);

  // Send standard Embed DM notification to revoked user
  try {
    const unlicenseEmbed = new EmbedBuilder()
      .setColor(0xFF0000)
      .setTitle('⚠️ License Revoked')
      .setDescription('Your license has been revoked by an administrator due to a violation of community rules or guidelines. All active selfbots associated with your account have been stopped and removed.')
      .setFooter({ text: getDynamicFooterText() });

    await targetUser.send({ embeds: [unlicenseEmbed] }).catch(() => null);

    await sendOrUpdateUserDM(targetUser, interaction.client);
  } catch (dmErr) {
    console.error(`Failed to send unlicense DM to ${targetUser.id}:`, dmErr);
  }

  await interaction.editReply({
    content: `✅ Successfully revoked license and stopped all selfbots for <@${targetUser.id}>.`
  });
}

module.exports = {
  unlicenseCommand,
  handleUnlicenseCommand
};
