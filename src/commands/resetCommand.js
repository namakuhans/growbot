const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const db = require('../database/db');
const { stopAllSelfbots } = require('../services/selfbotService');
const { updateActivePanel, updateMainBotRPC } = require('../services/panelService');

const resetCommand = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('Reset all database data and stop all running selfbots')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleResetCommand(interaction) {
  if (!db.isWhitelistedUser(interaction.user.id, interaction.member)) {
    await interaction.reply({
      content: '❌ You are not authorized to use the `/reset` command.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  stopAllSelfbots();
  db.resetDatabase();

  await updateActivePanel(interaction.client);
  updateMainBotRPC(interaction.client);

  await interaction.editReply({
    content: '🔄 All running selfbots and selfbot tokens have been cleared and reset. User licenses and resolved statistics have been preserved.'
  });
}

module.exports = {
  resetCommand,
  handleResetCommand
};
