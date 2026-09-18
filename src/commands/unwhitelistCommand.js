const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

const unwhitelistCommand = new SlashCommandBuilder()
  .setName('unwhitelist')
  .setDescription('Remove a user from whitelist')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('Target user to remove from whitelist')
      .setRequired(true)
  );

function isAllowedUser(interaction) {
  const envRoleId = process.env.ROLE_ID;
  if (envRoleId && interaction.member && interaction.member.roles && interaction.member.roles.cache) {
    if (interaction.member.roles.cache.has(envRoleId)) return true;
  }
  return false;
}

async function handleUnwhitelistCommand(interaction) {
  if (!isAllowedUser(interaction)) {
    return interaction.reply({
      content: 'You do not have permission to execute this command.',
      ephemeral: true
    });
  }

  const targetUser = interaction.options.getUser('user');
  db.removeWhitelistedUser(targetUser.id);

  const embed = new EmbedBuilder()
    .setTitle('User Unwhitelisted')
    .setDescription(`Successfully removed <@${targetUser.id}> (\`${targetUser.id}\`) from whitelist.`)
    .setColor(0xFF0000);

  return interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

module.exports = {
  unwhitelistCommand,
  handleUnwhitelistCommand
};
