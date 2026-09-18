const { extractComponentTexts } = require('./componentText');

/**
 * Extracts and parses farmable name and block count from message content/embeds/components.
 *
 * @param {Message} message
 * @returns {{ farmableName: string, blockCount: number }|null}
 */
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

  // Clean text: strip zero-width spaces, custom Discord emojis, markdown formatting
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

  // Clean farmableName: strip leading emojis / non-alphanumeric symbols e.g. "Rich Crystal"
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

/**
 * Extracts and parses Gems count from message content/embeds/components.
 *
 * @param {Message} message
 * @returns {number}
 */
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

  const patterns = [
    /Gems?:\s*([\d.,]+)/i,
    /Gems?\s+([\d.,]+)/i,
    /💎\s*([\d.,]+)/i,
    /([\d.,]+)\s*Gems?/i
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

module.exports = {
  parseFarmableInfo,
  parseGemsInfo
};
