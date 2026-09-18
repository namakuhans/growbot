const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');

const whitelistCommand = new SlashCommandBuilder()
  .setName('whitelist')
  .setDescription('Whitelist a user for permanent access')
  .addUserOption(option =>
    option.setName('user')
      .setDescription('Target user to whitelist')
      .setRequired(true)
  );

function isAllowedUser(interaction) {
  const envRoleId = process.env.ROLE_ID;
  if (envRoleId && interaction.member && interaction.member.roles && interaction.member.roles.cache) {
    if (interaction.member.roles.cache.has(envRoleId)) return true;
  }
  return false;
}

async function handleWhitelistCommand(interaction) {
  if (!isAllowedUser(interaction)) {
    return interaction.reply({
      content: 'You do not have permission to execute this command.',
      ephemeral: true
    });
  }

  const targetUser = interaction.options.getUser('user');
  db.addWhitelistedUser(targetUser.id, interaction.user.id);

  const embed = new EmbedBuilder()
    .setTitle('User Whitelisted')
    .setDescription(`Successfully whitelisted <@${targetUser.id}> (\`${targetUser.id}\`). User now has permanent access.`)
    .setColor(0x37FF00);

  return interaction.reply({
    embeds: [embed],
    ephemeral: true
  });
}

module.exports = {
  whitelistCommand,
  handleWhitelistCommand
};
