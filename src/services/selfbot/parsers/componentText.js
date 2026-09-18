/**
 * Extracts all readable text recursively from ComponentV2 structures and components.
 *
 * @param {Array} components
 * @returns {string}
 */
function extractComponentTexts(components) {
  if (!components || !Array.isArray(components)) return '';
  let text = '';
  for (const comp of components) {
    if (!comp) continue;
    if (comp.content) text += '\n' + comp.content;
    if (comp.text) text += '\n' + comp.text;
    if (comp.label) text += '\n' + comp.label;
    if (comp.title) text += '\n' + comp.title;
    if (comp.description) text += '\n' + comp.description;
    if (comp.placeholder) text += '\n' + comp.placeholder;
    if (comp.components && Array.isArray(comp.components)) {
      text += extractComponentTexts(comp.components);
    }
    if (comp.options && Array.isArray(comp.options)) {
      for (const opt of comp.options) {
        if (!opt) continue;
        if (opt.label) text += '\n' + opt.label;
        if (opt.description) text += '\n' + opt.description;
        if (opt.value) text += '\n' + opt.value;
      }
    }
    if (comp.items && Array.isArray(comp.items)) {
      text += extractComponentTexts(comp.items);
    }
  }
  return text;
}

/**
 * Recursively collects all button components from any message structure
 * (checking components, data.components, _raw.components).
 *
 * @param {Message} message
 * @returns {Array}
 */
function getAllButtons(message) {
  if (!message) return [];
  const buttons = [];

  const traverse = (components) => {
    if (!Array.isArray(components)) return;
    for (const comp of components) {
      if (!comp) continue;
      if (comp.type === 2 || comp.type === '2' || comp.type === 'BUTTON' || comp.label || comp.customId || comp.custom_id) {
        // Exclude select menus
        if (!comp.options && comp.type !== 3 && comp.type !== '3' && comp.type !== 'STRING_SELECT' && comp.type !== 'SELECT_MENU') {
          buttons.push(comp);
        }
      }
      if (comp.components && Array.isArray(comp.components)) {
        traverse(comp.components);
      }
      if (comp.items && Array.isArray(comp.items)) {
        traverse(comp.items);
      }
    }
  };

  if (Array.isArray(message.components)) traverse(message.components);
  if (Array.isArray(message.data?.components)) traverse(message.data.components);
  if (Array.isArray(message._raw?.components)) traverse(message._raw.components);

  // De-duplicate buttons by customId/custom_id/id/label
  const uniqueButtons = [];
  const seenKeys = new Set();
  for (const b of buttons) {
    const key = b.customId || b.custom_id || b.id || b.label;
    if (key && !seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueButtons.push(b);
    }
  }

  return uniqueButtons;
}

module.exports = {
  extractComponentTexts,
  getAllButtons
};
