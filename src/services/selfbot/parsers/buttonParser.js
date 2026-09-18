const { getAllButtons } = require('./componentText');

/**
 * Finds a button by label keywords, customId keywords, or emoji names.
 *
 * @param {Message} message
 * @param {string|string[]} labelKeywords
 * @returns {Object|null}
 */
function findButton(message, labelKeywords) {
  if (!message) return null;
  const buttons = getAllButtons(message);
  if (buttons.length === 0) return null;

  const keywords = Array.isArray(labelKeywords) ? labelKeywords : [labelKeywords];

  for (const comp of buttons) {
    const labelLower = (comp.label || '').toLowerCase();
    const customIdLower = (comp.customId || comp.custom_id || '').toLowerCase();
    const emojiNameLower = (comp.emoji?.name || '').toLowerCase();

    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();
      if (
        labelLower.includes(kwLower) ||
        customIdLower.includes(kwLower) ||
        emojiNameLower.includes(kwLower)
      ) {
        return comp;
      }
    }
  }
  return null;
}

/**
 * Extracts specific Gamebot buttons from message components.
 *
 * @param {Message} message
 * @returns {{ keepFarmingButton: Object|null, toggleAutoFarmButton: Object|null, farmButton: Object|null }}
 */
function extractButtons(message) {
  let keepFarmingButton = null;
  let toggleAutoFarmButton = null;
  let farmButton = null;

  const buttons = getAllButtons(message);

  for (const comp of buttons) {
    const labelLower = (comp.label || '').toLowerCase();
    const customIdLower = (comp.customId || comp.custom_id || '').toLowerCase();

    if (
      labelLower.includes('keep farming') ||
      customIdLower.includes('keep_farming') ||
      customIdLower.includes('keepfarming')
    ) {
      keepFarmingButton = comp;
    } else if (
      labelLower.includes('toggle auto farm') ||
      labelLower.includes('toggle_auto_farm') ||
      customIdLower.includes('toggle_auto_farm') ||
      customIdLower.includes('toggleautofarm')
    ) {
      toggleAutoFarmButton = comp;
    } else if (
      labelLower === 'farm' ||
      customIdLower.endsWith('_farm') ||
      customIdLower.includes('action_farm') ||
      (labelLower.includes('farm') && !labelLower.includes('toggle') && !labelLower.includes('keep'))
    ) {
      farmButton = comp;
    }
  }
  return { keepFarmingButton, toggleAutoFarmButton, farmButton };
}

module.exports = {
  findButton,
  extractButtons
};
