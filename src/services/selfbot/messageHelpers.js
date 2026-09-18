const { GAMEBOT_ID, APPLICATION_ID } = require('../../config/constants');
const { findButton } = require('./parsers');

/**
 * Checks if a message was authored or sent by Gamebot/Application.
 *
 * @param {Message} msg
 * @returns {boolean}
 */
function isGamebotMessage(msg) {
  if (!msg) return false;
  const isBot = (
    (msg.author && (msg.author.id === GAMEBOT_ID || msg.author.id === APPLICATION_ID || msg.author.bot)) ||
    msg.applicationId === APPLICATION_ID ||
    msg.applicationId === GAMEBOT_ID
  );
  if (!isBot) return false;
  const hasComponents = Array.isArray(msg.components) && msg.components.length > 0;
  const hasEmbeds = Array.isArray(msg.embeds) && msg.embeds.length > 0;
  const hasContent = typeof msg.content === 'string' && msg.content.trim().length > 0;
  return hasComponents || hasEmbeds || hasContent;
}

/**
 * Fetches the most recent Gamebot message from the channel.
 *
 * @param {TextChannel} channel
 * @returns {Promise<Message|null>}
 */
async function fetchLatestGamebotMessage(channel) {
  try {
    const messages = await channel.messages.fetch({ limit: 15, force: true }).catch(() => null);
    if (!messages || messages.size === 0) return null;

    for (const msg of messages.values()) {
      if (isGamebotMessage(msg)) return msg;
    }
  } catch (e) {}
  return null;
}

/**
 * Waits for a Gamebot message in `channel` that contains ANY of the given
 * button keywords or text keywords. Polls every `retryDelayMs` ms for up to
 * `maxRetries` attempts.
 *
 * @param {TextChannel} channel
 * @param {string[]}    keywords
 * @param {number}      maxRetries
 * @param {number}      retryDelayMs
 * @returns {Promise<Message|null>}
 */
async function waitForGamebotWithKeywords(channel, keywords = [], maxRetries = 8, retryDelayMs = 1000) {
  const kwList = Array.isArray(keywords) ? keywords.filter(Boolean) : (keywords ? [keywords] : []);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    await new Promise(r => setTimeout(r, retryDelayMs));

    try {
      const messages = await channel.messages.fetch({ limit: 10, force: true }).catch(() => null);
      if (!messages || messages.size === 0) continue;

      for (const msg of messages.values()) {
        if (!isGamebotMessage(msg)) continue;

        if (kwList.length === 0) return msg;

        // 1. Check if any button on the message matches any of the keywords
        const btn = findButton(msg, kwList);
        if (btn) return msg;

        // 2. Check combined text from content, embeds, and component texts
        let text = (msg.content || '').toLowerCase();
        const embeds = msg.embeds || msg.data?.embeds || [];
        for (const embed of embeds) {
          text += ' ' + (embed.title || embed.data?.title || '').toLowerCase();
          text += ' ' + (embed.description || embed.data?.description || '').toLowerCase();
          const fields = embed.fields || embed.data?.fields || [];
          for (const f of fields) text += ' ' + (f.name || '').toLowerCase() + ' ' + (f.value || '').toLowerCase();
        }

        // Match if ANY of the keywords is found in the text
        if (kwList.some(kw => text.includes(kw.toLowerCase()))) {
          return msg;
        }
      }
    } catch (e) {
      // Ignore fetch errors and retry
    }
  }

  return null;
}

module.exports = {
  isGamebotMessage,
  fetchLatestGamebotMessage,
  waitForGamebotWithKeywords
};
