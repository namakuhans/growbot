const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');

const db = require('../database/db');
const { MessageFlags } = require('discord.js');
const { autoGrantRoleLicense } = require('../services/roleLicenseService');

async function handleButtonInteraction(interaction) {
  // Main Panel Login Button
  if (interaction.customId === 'btn_login_selfbot') {
    // Auto-grant permanent license if user has the configured ROLE_ID
    autoGrantRoleLicense(interaction.member, interaction.user.id);

    // Check if user has access (whitelisted or active license)
    if (!db.hasUserAccess(interaction.user.id, interaction.member)) {
      await interaction.reply({
        content: '❌ You do not have an active license to use this tool. Please contact an administrator to get a license.',
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    const modal = new ModalBuilder()
      .setCustomId('modal_login_selfbot')
      .setTitle('Login Selfbot Discord');

    const tokenInput = new TextInputBuilder()
      .setCustomId('input_token')
      .setLabel('Discord Selfbot Token')
      .setPlaceholder('Masukkan token akun Discord selfbot Anda...')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const threadInput = new TextInputBuilder()
      .setCustomId('input_thread_id')
      .setLabel('Thread ID (Target AFK)')
      .setPlaceholder('Masukkan ID Thread Discord target...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const proxyInput = new TextInputBuilder()
      .setCustomId('input_proxy')
      .setLabel('Proxy (Opsional | No proxy tanggung sendiri!)')
      .setPlaceholder('http://user:pass@host:port  |  Kosongkan = IP asli server')
      .setStyle(TextInputStyle.Short)
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(tokenInput),
      new ActionRowBuilder().addComponents(threadInput),
      new ActionRowBuilder().addComponents(proxyInput)
    );

    await interaction.showModal(modal);
    return true;
  }

  // Change Thread Button from DM
  if (interaction.customId.startsWith('btn_change_thread_')) {
    const token = interaction.customId.replace('btn_change_thread_', '');
    const modal = new ModalBuilder()
      .setCustomId(`modal_change_thread_${token}`)
      .setTitle('Change Thread ID');

    const threadInput = new TextInputBuilder()
      .setCustomId('input_new_thread_id')
      .setLabel('Thread ID Baru')
      .setPlaceholder('Masukkan ID Thread Discord baru...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(threadInput));
    await interaction.showModal(modal);
    return true;
  }

  // Set Webhook URL Button from DM Panel
  if (interaction.customId === 'btn_set_webhook_url') {
    const userSelfbots = db.getSelfbotsByUser(interaction.user.id);
    const existingWebhook = userSelfbots.find(s => s.webhookUrl)?.webhookUrl || '';

    const modal = new ModalBuilder()
      .setCustomId('modal_set_webhook_url')
      .setTitle('Set Webhook URL Notifikasi');

    const webhookInput = new TextInputBuilder()
      .setCustomId('input_webhook_url')
      .setLabel('Discord Webhook URL')
      .setPlaceholder('https://discord.com/api/webhooks/... (Kosongkan = Hapus)')
      .setValue(existingWebhook)
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false);

    modal.addComponents(new ActionRowBuilder().addComponents(webhookInput));
    await interaction.showModal(modal);
    return true;
  }

  return false;
}

module.exports = { handleButtonInteraction };
