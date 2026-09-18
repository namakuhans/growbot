const { EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const { createUserDMManagementComponents } = require('../services/dmService');
const { updateActivePanel, updateMainBotRPC } = require('../services/panelService');
const { startSelfbot } = require('../services/selfbotService');

async function handleModalSubmission(interaction) {
  // Login Modal Submit
  if (interaction.customId === 'modal_login_selfbot') {
    await interaction.deferReply({ ephemeral: true });

    const token = interaction.fields.getTextInputValue('input_token').trim();
    const threadId = interaction.fields.getTextInputValue('input_thread_id').trim();

    const selfClient = await startSelfbot(token, threadId, interaction.user.id, interaction.client);

    if (!selfClient) {
      const errEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('❌ Login Selfbot Gagal')
        .setDescription('Token selfbot yang Anda masukkan tidak valid atau tidak dapat terhubung. Silakan periksa kembali token Anda.')
        .setTimestamp();

      await interaction.user.send({ embeds: [errEmbed] }).catch(() => null);
      await interaction.editReply({ content: '❌ Login gagal! Rincian kesalahan telah dikirim ke DM Anda.' });
      return true;
    }

    const { sendOrUpdateUserDM } = require('../services/dmService');
    await sendOrUpdateUserDM(interaction.user, interaction.client);

    await interaction.editReply({ content: '✅ Selfbot login successful! Management details have been updated in your DMs.' });
    await updateActivePanel(interaction.client);
    updateMainBotRPC(interaction.client);
    return true;
  }

  // Change Thread Modal Submit
  if (interaction.customId.startsWith('modal_change_thread_')) {
    await interaction.deferReply({ ephemeral: true });
    const token = interaction.customId.replace('modal_change_thread_', '');
    const newThreadId = interaction.fields.getTextInputValue('input_new_thread_id').trim();

    const updated = db.updateSelfbotThread(token, newThreadId);

    if (updated) {
      // Re-start / re-initialize selfbot to immediately trigger startup check & auto-buy flow on the new thread ID
      startSelfbot(token, newThreadId, interaction.user.id, interaction.client).catch(() => null);

      const { sendOrUpdateUserDM } = require('../services/dmService');
      await sendOrUpdateUserDM(interaction.user, interaction.client);
      await interaction.editReply({ content: `✅ Thread ID berhasil diperbarui menjadi \`${newThreadId}\`! Selfbot sedang memeriksa status thread baru.` });
    } else {
      await interaction.editReply({ content: '❌ Akun selfbot tidak ditemukan.' });
    }
    return true;
  }

  return false;
}

module.exports = { handleModalSubmission };
