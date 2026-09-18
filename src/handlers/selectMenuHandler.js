const db = require('../database/db');
const { createUserDMManagementComponents } = require('../services/dmService');
const { updateActivePanel, updateMainBotRPC } = require('../services/panelService');
const { stopSelfbot } = require('../services/selfbotService');

async function handleSelectMenuInteraction(interaction) {
  if (interaction.customId === 'select_logout_selfbot') {
    await interaction.deferReply({ ephemeral: true });
    const tokenToRemove = interaction.values[0];

    stopSelfbot(tokenToRemove);
    db.removeSelfbot(tokenToRemove);

    const { sendOrUpdateUserDM } = require('../services/dmService');
    await sendOrUpdateUserDM(interaction.user, interaction.client);

    await interaction.editReply({ content: '🗑️ Akun selfbot berhasil di-logout dan dihapus dari sistem.' });
    await updateActivePanel(interaction.client);
    updateMainBotRPC(interaction.client);
    return true;
  }

  return false;
}

module.exports = { handleSelectMenuInteraction };
