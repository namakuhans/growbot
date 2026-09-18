const { SnowflakeUtil } = require('discord.js-selfbot-v13');
const { GAMEBOT_ID, APPLICATION_ID, FARM_START_CHANNEL_ID } = require('../../config/constants');
const { findButton } = require('./parsers');

// The exact custom_id payload for the 'Start Farming' button from Gamebot
const START_FARMING_CUSTOM_ID = 'growcord:start-farming';

/**
 * Clicks the 'Start Farming' button in the target channel using standard click
 * and interaction API POST fallback.
 *
 * @param {Client} selfClient
 * @param {TextChannel} startChannel
 * @param {Message} gamebotMsg
 * @param {Object} buttonComp
 * @returns {Promise<Message|null>}
 */
async function clickStartFarmingButton(selfClient, startChannel, gamebotMsg, buttonComp) {
  try {
    const customId = buttonComp.customId || buttonComp.custom_id;
    console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Clicking 'Start Farming' button (${customId})...`);

    // 1. Try standard clickButton
    const resMsg = await gamebotMsg.clickButton(customId).catch(() => null);
    if (resMsg) return resMsg;

    // 2. Direct interaction API POST fallback
    const flagsBitfield = (gamebotMsg.flags ? gamebotMsg.flags.bitfield : 0) | 32768; // IS_COMPONENTS_V2
    const nonce = SnowflakeUtil.generate();
    const clickData = {
      type: 3, // MESSAGE_COMPONENT
      nonce,
      guild_id: gamebotMsg.guildId || startChannel.guild?.id || '1210564755887231036',
      channel_id: startChannel.id || FARM_START_CHANNEL_ID,
      message_id: gamebotMsg.id,
      application_id: gamebotMsg.applicationId || APPLICATION_ID || GAMEBOT_ID,
      session_id: selfClient.sessionId,
      message_flags: flagsBitfield,
      data: {
        component_type: 2, // BUTTON
        custom_id: customId
      }
    };

    await selfClient.api.interactions.post({ data: clickData }).catch(err => {
      console.error('[SELFBOT AUTO-RECOVERY BUTTON POST ERROR]', err.message || err);
    });
  } catch (e) {
    console.error('[SELFBOT AUTO-RECOVERY CLICK ERROR]', e.message || e);
  }
  return null;
}

/**
 * Finds the 'Start Farming' button in a message.
 * Priority: exact custom_id "growcord:start-farming" > label keyword fallback.
 *
 * @param {Message} message
 * @returns {Object|null}
 */
function findStartFarmingButton(message) {
  if (!message) return null;

  // Priority 1: exact custom_id match
  const traverse = (components) => {
    if (!Array.isArray(components)) return null;
    for (const comp of components) {
      if (!comp) continue;
      const cid = comp.customId || comp.custom_id || '';
      if (cid === START_FARMING_CUSTOM_ID) return comp;
      if (comp.components && Array.isArray(comp.components)) {
        const found = traverse(comp.components);
        if (found) return found;
      }
      if (comp.items && Array.isArray(comp.items)) {
        const found = traverse(comp.items);
        if (found) return found;
      }
    }
    return null;
  };

  let exactMatch = null;
  if (Array.isArray(message.components)) exactMatch = traverse(message.components);
  if (!exactMatch && Array.isArray(message.data?.components)) exactMatch = traverse(message.data.components);
  if (!exactMatch && Array.isArray(message._raw?.components)) exactMatch = traverse(message._raw.components);
  if (exactMatch) return exactMatch;

  // Priority 2: label keyword fallback (label only, not 'farming' to avoid false positives)
  return findButton(message, ['start farming', 'start_farming']);
}

module.exports = {
  START_FARMING_CUSTOM_ID,
  clickStartFarmingButton,
  findStartFarmingButton
};
