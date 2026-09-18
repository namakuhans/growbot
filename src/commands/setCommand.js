const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');
const { createPanelComponents, updateMainBotRPC } = require('../services/panelService');

const setCommand = new SlashCommandBuilder()
  .setName('set')
  .setDescription('Mengirim control panel containerv2 untuk login dan manajemen selfbot')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleSetCommand(interaction) {
  if (!db.isWhitelistedUser(interaction.user.id, interaction.member)) {
    await interaction.reply({
      content: '❌ You are not authorized to use the `/set` command.',
      flags: require('discord.js').MessageFlags.Ephemeral
    });
    return;
  }

  const panelData = createPanelComponents(interaction.client);
  const replyMsg = await interaction.reply({ ...panelData, fetchReply: true });

  db.setPanel(interaction.channelId, replyMsg.id);
  updateMainBotRPC(interaction.client);
}

module.exports = {
  setCommand,
  handleSetCommand
};
