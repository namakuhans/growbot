const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } = require('discord.js');
const db = require('../database/db');
const { getDynamicFooterText } = require('../config/constants');

const licenseCommand = new SlashCommandBuilder()
  .setName('license')
  .setDescription('Grant tool license duration to a user')
  .addUserOption(opt =>
    opt.setName('user')
      .setDescription('Target user to grant license to')
      .setRequired(true)
  )
  .addIntegerOption(opt =>
    opt.setName('day')
      .setDescription('Number of days for license validity')
      .setRequired(true)
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function handleLicenseCommand(interaction) {
  // Check if execution user is whitelisted / admin
  if (!db.isWhitelistedUser(interaction.user.id, interaction.member)) {
    await interaction.reply({
      content: '❌ You are not authorized to use the `/license` command.',
      flags: MessageFlags.Ephemeral
    });
    return;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUser = interaction.options.getUser('user');
  const days = interaction.options.getInteger('day');

  if (days <= 0) {
    await interaction.editReply({ content: '❌ License duration must be greater than 0 days.' });
    return;
  }

  // Grant license
  const license = db.setUserLicense(targetUser.id, days, interaction.user.id);
  const expiresTimestamp = Math.floor(license.expiresAt / 1000);

  // Send standard Embed notification DM to target user
  try {
    const dmEmbed = new EmbedBuilder()
      .setColor(0x37FF00)
      .setTitle('📜 License Granted')
      .setDescription(`You have been granted a **${days} day(s)** license to use Growcord Automated tools!\n\n**Duration:** ${days} Days\n**Expires:** <t:${expiresTimestamp}:R> (<t:${expiresTimestamp}:F>)`)
      .setFooter({ text: getDynamicFooterText() });

    await targetUser.send({ embeds: [dmEmbed] }).catch(() => null);
  } catch (dmErr) {
    console.error(`Failed to send license DM to ${targetUser.id}:`, dmErr);
  }

  await interaction.editReply({
    content: `✅ Successfully granted a **${days} day(s)** license to <@${targetUser.id}>!\n**Expires:** <t:${expiresTimestamp}:R>`
  });
}

module.exports = {
  licenseCommand,
  handleLicenseCommand
};
