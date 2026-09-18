const { handleSetCommand } = require('../commands/setCommand');
const { handleResetCommand } = require('../commands/resetCommand');
const { handleLicenseCommand } = require('../commands/licenseCommand');
const { handleUnlicenseCommand } = require('../commands/unlicenseCommand');
const { handleWhitelistCommand } = require('../commands/whitelistCommand');
const { handleUnwhitelistCommand } = require('../commands/unwhitelistCommand');
const { handleButtonInteraction } = require('./buttonHandler');
const { handleModalSubmission } = require('./modalHandler');
const { handleSelectMenuInteraction } = require('./selectMenuHandler');

async function handleInteraction(interaction) {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'set') {
        await handleSetCommand(interaction);
      } else if (interaction.commandName === 'reset') {
        await handleResetCommand(interaction);
      } else if (interaction.commandName === 'license') {
        await handleLicenseCommand(interaction);
      } else if (interaction.commandName === 'unlicense') {
        await handleUnlicenseCommand(interaction);
      } else if (interaction.commandName === 'whitelist') {
        await handleWhitelistCommand(interaction);
      } else if (interaction.commandName === 'unwhitelist') {
        await handleUnwhitelistCommand(interaction);
      }
      return;
    }

    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleModalSubmission(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction);
      return;
    }
  } catch (err) {
    console.error('[MAIN BOT INTERACTION ERROR]', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: 'Terjadi kesalahan saat memproses permintaan.', ephemeral: true }).catch(() => null);
    }
  }
}

module.exports = { handleInteraction };
