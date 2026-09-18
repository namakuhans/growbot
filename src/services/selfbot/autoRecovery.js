const { SnowflakeUtil } = require('discord.js-selfbot-v13');
const db = require('../../database/db');
const { GAMEBOT_ID, FARM_START_CHANNEL_ID } = require('../../config/constants');
const { findButton } = require('./parsers');
const { scheduleProfileCommand } = require('./profileScheduler');

const autoRecoveryState = new Map();

// The exact custom_id payload for the 'Start Farming' button from Gamebot
const START_FARMING_CUSTOM_ID = 'growcord:start-farming';

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
      guild_id: gamebotMsg.guildId || '1210564755887231036',
      channel_id: startChannel.id || FARM_START_CHANNEL_ID,
      message_id: gamebotMsg.id,
      application_id: gamebotMsg.applicationId ?? GAMEBOT_ID,
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
 * Find the 'Start Farming' button in a message.
 * Priority: exact custom_id "growcord:start-farming" > label keyword fallback.
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

async function triggerThreadAutoRecovery(selfClient, token, userId, mainClient, activeSelfbots, performThreadStartupCheck) {
  if (autoRecoveryState.get(token)) return;
  autoRecoveryState.set(token, true);

  console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Thread ID became invalid. Triggering 'Start Farming' recovery in channel ${FARM_START_CHANNEL_ID}...`);

  try {
    let startChannel = await selfClient.channels.fetch(FARM_START_CHANNEL_ID).catch(() => null);

    // Fallback: fetch via guild channels if direct channel fetch returned null
    if (!startChannel) {
      const guild = await selfClient.guilds.fetch('1210564755887231036').catch(() => null);
      if (guild) {
        startChannel = await guild.channels.fetch(FARM_START_CHANNEL_ID).catch(() => null);
      }
    }

    if (!startChannel) {
      console.error(`[SELFBOT AUTO-RECOVERY] Could not fetch channel ${FARM_START_CHANNEL_ID}. Aborting recovery.`);
      return;
    }

    let capturedThreadId = null;

    // ── Listener 1: threadCreate ──────────────────────────────────────────────
    const threadCreateListener = async (thread) => {
      try {
        if (!thread || capturedThreadId) return;
        if (thread.parentId === FARM_START_CHANNEL_ID || (thread.name && thread.name.toLowerCase().includes('farm-'))) {
          capturedThreadId = thread.id;
          console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Captured new thread ID <#${capturedThreadId}> via threadCreate event.`);
        }
      } catch (e) {}
    };

    // ── Listener 2: messageCreate — only from Gamebot, only "Your farm is ready:" ──
    const messageListener = async (msg) => {
      try {
        if (!msg || capturedThreadId) return;
        // Only process messages sent by Gamebot
        if (msg.author?.id !== GAMEBOT_ID) return;

        const content = msg.content || '';
        const match = content.match(/Your farm is ready:\s*<#(\d+)>/i);
        if (match && match[1]) {
          capturedThreadId = match[1];
          console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Captured new thread ID <#${capturedThreadId}> from Gamebot message.`);
        }
      } catch (e) {}
    };

    // ── Listener 3: raw gateway — only Gamebot, only "Your farm is ready:" ─────
    const rawListener = async (packet) => {
      try {
        if (!packet || capturedThreadId) return;
        const data = packet.d;
        if (!data) return;

        // Only process packets from Gamebot (MESSAGE_CREATE / ephemeral INTERACTION_CREATE)
        const authorId = data.author?.id || data.message?.author?.id || '';
        if (authorId && authorId !== GAMEBOT_ID) return;

        const strData = typeof data === 'string' ? data : JSON.stringify(data);
        const match = strData.match(/Your farm is ready:\s*<#(\d+)>/i);
        if (match && match[1]) {
          capturedThreadId = match[1];
          console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Captured new thread ID <#${capturedThreadId}> from raw Gamebot packet.`);
        }
      } catch (e) {}
    };

    selfClient.on('threadCreate', threadCreateListener);
    selfClient.on('messageCreate', messageListener);
    if (selfClient.ws) selfClient.ws.on('raw', rawListener);

    // ── Polling loop: find & click 'Start Farming' button ────────────────────
    let attempts = 0;

    while (!capturedThreadId && attempts < 15) {
      attempts++;
      console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Polling channel ${FARM_START_CHANNEL_ID} for 'Start Farming' button (Attempt ${attempts}/15)...`);

      const messages = await startChannel.messages.fetch({ limit: 15 }).catch(() => null);
      if (messages && messages.size > 0) {
        let targetMsg = null;
        let startBtn = null;

        for (const msg of messages.values()) {
          // Only consider messages from Gamebot
          if (msg.author?.id !== GAMEBOT_ID) continue;

          const btn = findStartFarmingButton(msg);
          if (btn) {
            targetMsg = msg;
            startBtn = btn;
            break;
          }
        }

        if (targetMsg && startBtn && !startBtn.disabled) {
          console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Found 'Start Farming' button (custom_id: ${startBtn.customId || startBtn.custom_id}) on message ${targetMsg.id}. Clicking...`);
          const resMsg = await clickStartFarmingButton(selfClient, startChannel, targetMsg, startBtn);
          if (resMsg && !capturedThreadId) {
            const resStr = typeof resMsg === 'string' ? resMsg : JSON.stringify(resMsg);
            const match = resStr.match(/Your farm is ready:\s*<#(\d+)>/i);
            if (match && match[1]) {
              capturedThreadId = match[1];
              console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Captured new thread ID <#${capturedThreadId}> from clickButton response.`);
            }
          }
        } else {
          console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: 'Start Farming' button not found yet from Gamebot. Retrying in 4s...`);
        }
      }

      if (!capturedThreadId) {
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    }

    // ── Cleanup listeners ────────────────────────────────────────────────────
    selfClient.removeListener('threadCreate', threadCreateListener);
    selfClient.removeListener('messageCreate', messageListener);
    if (selfClient.ws) selfClient.ws.removeListener('raw', rawListener);

    if (capturedThreadId) {
      // ── Update database with new thread ID ──────────────────────────────────
      const dispName = selfClient.user?.displayName || selfClient.user?.globalName || selfClient.user?.username || selfClient.user?.tag || 'Selfbot';
      db.addOrUpdateSelfbot(token, capturedThreadId, userId, dispName);
      console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Database updated with new Thread ID <#${capturedThreadId}>.`);

      // ── Update dashboard panels ─────────────────────────────────────────────
      if (mainClient) {
        try {
          const { updateActivePanel, updateMainBotRPC } = require('../panelService');
          const { sendOrUpdateUserDM } = require('../dmService');
          updateActivePanel(mainClient);
          updateMainBotRPC(mainClient);

          const user = await mainClient.users.fetch(userId).catch(() => null);
          if (user) sendOrUpdateUserDM(user, mainClient);
        } catch (e) {}
      }

      // ── Step: JOIN the new thread before continuing ─────────────────────────
      console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Joining recovered thread <#${capturedThreadId}>...`);
      const recoveredThread = await selfClient.channels.fetch(capturedThreadId).catch(() => null);
      if (recoveredThread && typeof recoveredThread.join === 'function') {
        await recoveredThread.join().catch(() => null);
        console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Successfully joined thread <#${capturedThreadId}>.`);
      } else {
        console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Thread <#${capturedThreadId}> fetched (join not required or already member).`);
      }

      // ── Resume profile scheduler with new thread ID ─────────────────────────
      scheduleProfileCommand(selfClient, token, capturedThreadId, activeSelfbots);

      // ── Execute startup check on recovered thread ───────────────────────────
      console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Triggering startup check on recovered thread <#${capturedThreadId}>...`);
      if (typeof performThreadStartupCheck === 'function') {
        await performThreadStartupCheck(selfClient, capturedThreadId, mainClient);
      }
    } else {
      console.warn(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Timed out after 15 attempts. Could not capture new thread ID from Gamebot.`);
    }
  } catch (err) {
    console.error(`[SELFBOT AUTO-RECOVERY ERROR] ${selfClient.user?.tag || 'Selfbot'}:`, err);
  } finally {
    autoRecoveryState.set(token, false);
  }
}

module.exports = {
  triggerThreadAutoRecovery,
  autoRecoveryState
};
