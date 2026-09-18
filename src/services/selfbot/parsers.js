// Helper function to extract all text recursively from ComponentV2 structures and components
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

// Helper to recursively collect all button components from any message structure (checking components, data.components, _raw.components)
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

// Robust helper to parse 'Current Farmable' text and block count from message content/embeds/components
function parseFarmableInfo(message) {
  if (!message) return null;

  let fullText = message.content || '';

  // Extract from embeds (supporting both direct properties and raw embed.data properties)
  const embeds = message.embeds || message.data?.embeds || [];
  if (Array.isArray(embeds) && embeds.length > 0) {
    for (const embed of embeds) {
      const title = embed.title || embed.data?.title || '';
      const description = embed.description || embed.data?.description || '';
      const fields = embed.fields || embed.data?.fields || [];

      if (title) fullText += '\n' + title;
      if (description) fullText += '\n' + description;
      if (Array.isArray(fields)) {
        for (const field of fields) {
          fullText += `\n${field.name || ''}: ${field.value || ''}`;
        }
      }
    }
  }

  // Extract from components (checking all possible component sources)
  if (Array.isArray(message.components)) fullText += extractComponentTexts(message.components);
  if (Array.isArray(message.data?.components)) fullText += extractComponentTexts(message.data.components);
  if (Array.isArray(message._raw?.components)) fullText += extractComponentTexts(message._raw.components);

  if (!fullText.trim()) return null;

  // Clean text: strip zero-width spaces, custom Discord emojis (<a:name:id>), markdown formatting (*, _, ~, `, #, >, \)
  const cleanText = fullText
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
    .replace(/<a?:[\w_]+:\d+>/g, '')
    .replace(/[*_~`#>\\]/g, '')
    .replace(/\r\n/g, '\n');

  let farmableName = null;
  let blockCount = null;

  // Pattern 1: Current Farmable: Name (100 Blocks) or Current Farmable: [emoji] Name (100 Blocks)
  let farmableRegex = /(?:Current\s*Farmable|Farmable):\s*([^\(\n\r]+?)\s*\(([\d.,\s]+)\s*Blocks?\)/i;
  let match = cleanText.match(farmableRegex);

  if (match) {
    farmableName = match[1].trim();
    const rawVal = match[2].replace(/[.,\s]/g, '');
    const parsedCount = parseInt(rawVal, 10);
    if (!isNaN(parsedCount)) {
      blockCount = parsedCount;
    }
  }

  // Pattern 2: Current Farmable: Name \n 100 Blocks OR Farmable: Name \n 100 Blocks
  if (blockCount === null || !farmableName) {
    farmableRegex = /(?:Current\s*Farmable|Farmable):\s*([^\n\r]+)[\s\S]*?([\d.,\s]+)\s*Blocks?/i;
    match = cleanText.match(farmableRegex);
    if (match) {
      if (!farmableName) farmableName = match[1].trim().replace(/\(.*?\)/g, '').trim();
      const rawVal = match[2].replace(/[.,\s]/g, '');
      const parsedCount = parseInt(rawVal, 10);
      if (!isNaN(parsedCount)) {
        blockCount = parsedCount;
      }
    }
  }

  // Pattern 3: Fallback pattern for block count if not matched yet
  if (blockCount === null) {
    const blocksMatch = cleanText.match(/([\d.,\s]+)\s*Blocks?/i);
    if (blocksMatch) {
      const rawVal = blocksMatch[1].replace(/[.,\s]/g, '');
      const parsedCount = parseInt(rawVal, 10);
      if (!isNaN(parsedCount)) {
        blockCount = parsedCount;
      }
    }
  }

  // Fallback pattern for farmable name
  if (!farmableName) {
    const nameMatch = cleanText.match(/(?:Current\s*Farmable|Farmable):\s*([^\n\r\(]+)/i);
    if (nameMatch) {
      farmableName = nameMatch[1].trim();
    }
  }

  // Clean farmableName: strip leading emojis / non-alphanumeric symbols e.g. "🧙‍♂️ Rich Crystal" -> "Rich Crystal"
  if (farmableName) {
    farmableName = farmableName.replace(/^[^\w]+|[^\w\s-]+$/g, '').trim();
  }

  if (blockCount !== null && !isNaN(blockCount)) {
    return {
      farmableName: farmableName || 'Unknown Farmable',
      blockCount
    };
  }

  return null;
}

// Helper to parse Gems count from message content/embed/components
function parseGemsInfo(message) {
  if (!message) return 0;
  let fullText = message.content || '';

  const embeds = message.embeds || message.data?.embeds || [];
  if (Array.isArray(embeds) && embeds.length > 0) {
    for (const embed of embeds) {
      const title = embed.title || embed.data?.title || '';
      const description = embed.description || embed.data?.description || '';
      const fields = embed.fields || embed.data?.fields || [];

      if (title) fullText += '\n' + title;
      if (description) fullText += '\n' + description;
      if (Array.isArray(fields)) {
        for (const field of fields) {
          fullText += `\n${field.name || ''}: ${field.value || ''}`;
        }
      }
    }
  }

  if (Array.isArray(message.components)) fullText += extractComponentTexts(message.components);
  if (Array.isArray(message.data?.components)) fullText += extractComponentTexts(message.data.components);
  if (Array.isArray(message._raw?.components)) fullText += extractComponentTexts(message._raw.components);

  const cleanText = fullText
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ' ')
    .replace(/<a?:[\w_]+:\d+>/g, '')
    .replace(/[*_~`#]/g, '');

  // Match pattern: "Gems: 1,234,567" or "Gems: 645.663.241" or "💎 12345"
  const patterns = [
    /Gems?:\s*([\d.,\s]+)/i,
    /Gems?\s+([\d.,\s]+)/i,
    /💎\s*([\d.,\s]+)/i,
    /([\d.,\s]+)\s*Gems?/i
  ];

  for (const pat of patterns) {
    const match = cleanText.match(pat);
    if (match) {
      const rawVal = match[1].replace(/[.,\s]/g, '');
      const gems = parseInt(rawVal, 10);
      if (!isNaN(gems)) return gems;
    }
  }

  return 0;
}

// Helper to find button by label keywords or customId keywords
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

// Helper to extract buttons from main gamebot message
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

function getHumanDelay() {
  return Math.floor(Math.random() * 2000);
}

module.exports = {
  extractComponentTexts,
  getAllButtons,
  parseFarmableInfo,
  parseGemsInfo,
  findButton,
  extractButtons,
  getHumanDelay
};
