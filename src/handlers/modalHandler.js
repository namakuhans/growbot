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
    const proxyRaw = interaction.fields.getTextInputValue('input_proxy').trim();

    const { parseProxyUrl } = require('../services/selfbot/proxyHelper');

    // Validate proxy format if provided
    let proxy = null;
    if (proxyRaw) {
      const parsed = parseProxyUrl(proxyRaw);
      if (!parsed.valid) {
        await interaction.editReply({
          content: `❌ Format proxy tidak valid: \`${parsed.error}\`\nGunakan format: \`http://user:pass@host:port\``
        });
        return true;
      }
      proxy = parsed.url;
    }

    // Send proxy warning DM if no proxy provided
    if (!proxy) {
      const warnEmbed = new EmbedBuilder()
        .setColor(0xFF9900)
        .setTitle('⚠️ Peringatan: Selfbot Berjalan Tanpa Proxy!')
        .setDescription(
          '**Anda tidak mengisi proxy saat login selfbot.**\n\n' +
          'Selfbot akan berjalan menggunakan **IP asli server**, artinya Discord dapat ' +
          'mendeteksi bahwa beberapa akun terhubung dari alamat IP yang sama.\n\n' +
          '**Risiko:**\n' +
          '• Deteksi multi-akun dari 1 IP\n' +
          '• Peningkatan kemungkinan ban akun selfbot\n\n' +
          '**Rekomendasi:** Gunakan proxy HTTP unik per akun atau maksimal 2 akun per proxy.\n' +
          'Format: `http://user:pass@host:port`\n\n' +
          '> ⚠️ *Segala risiko pemblokiran akun ditanggung oleh pengguna.*'
        )
        .setTimestamp();
      await interaction.followUp({ embeds: [warnEmbed], ephemeral: true }).catch(() => null);
    }

    const selfClient = await startSelfbot(token, threadId, interaction.user.id, interaction.client, proxy);

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
      // Re-start / re-initialize selfbot — proxy is read from DB automatically via resolvedProxy fallback
      const existingProxy = updated.proxy || null;
      startSelfbot(token, newThreadId, interaction.user.id, interaction.client, existingProxy).catch(() => null);

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
