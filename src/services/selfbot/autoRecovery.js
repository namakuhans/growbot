const { SnowflakeUtil } = require('discord.js-selfbot-v13');
const db = require('../../database/db');
const { GAMEBOT_ID, FARM_START_CHANNEL_ID } = require('../../config/constants');
const { findButton } = require('./parsers');
const { scheduleProfileCommand } = require('./profileScheduler');

const autoRecoveryState = new Map();

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

async function triggerThreadAutoRecovery(selfClient, token, userId, mainClient, activeSelfbots, performThreadStartupCheck) {
  if (autoRecoveryState.get(token)) return;
  autoRecoveryState.set(token, true);

  console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Thread ID became invalid. Triggering 'Start Farming' in channel ${FARM_START_CHANNEL_ID}...`);

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
      console.error(`[SELFBOT AUTO-RECOVERY] Could not fetch channel ${FARM_START_CHANNEL_ID} in guild 1210564755887231036`);
      return;
    }

    let capturedThreadId = null;

    // 1. Listen for new thread creation events
    const threadCreateListener = async (thread) => {
      try {
        if (!thread || capturedThreadId) return;
        if (thread.parentId === FARM_START_CHANNEL_ID || (thread.name && thread.name.toLowerCase().includes('farm-'))) {
          capturedThreadId = thread.id;
          console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Captured new thread ID <#${capturedThreadId}> from threadCreate event!`);
        }
      } catch (e) {}
    };

    // 2. Listen for Gamebot messages/ephemeral messages
    const messageListener = async (msg) => {
      try {
        if (!msg || capturedThreadId) return;
        const fullStr = typeof msg === 'string' ? msg : JSON.stringify(msg);
        const match = fullStr.match(/Your farm is ready:\s*<#(\d+)>/i) || fullStr.match(/farm-(\d+)/i) || fullStr.match(/<#(\d+)>/);
        if (match && match[1]) {
          capturedThreadId = match[1];
          console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Captured new thread ID <#${capturedThreadId}> from message!`);
        }
      } catch (e) {}
    };

    // 3. Listen for raw gateway packets
    const rawListener = async (packet) => {
      try {
        if (!packet || capturedThreadId) return;
        const data = packet.d;
        if (!data) return;

        const strData = typeof data === 'string' ? data : JSON.stringify(data);
        const match = strData.match(/Your farm is ready:\s*<#(\d+)>/i) || strData.match(/<#(\d+)>/);
        if (match && match[1]) {
          capturedThreadId = match[1];
          console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Captured new thread ID <#${capturedThreadId}> from raw packet!`);
        }
      } catch (e) {}
    };

    selfClient.on('threadCreate', threadCreateListener);
    selfClient.on('messageCreate', messageListener);
    if (selfClient.ws) selfClient.ws.on('raw', rawListener);

    // Loop every 4 seconds to detect message/embed with 'Start Farming' button and click it
    let attempts = 0;

    while (!capturedThreadId && attempts < 15) {
      attempts++;
      console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Polling channel ${FARM_START_CHANNEL_ID} for 'Start Farming' button (Attempt ${attempts}/15)...`);

      const messages = await startChannel.messages.fetch({ limit: 15 }).catch(() => null);
      if (messages && messages.size > 0) {
        // Search across all fetched messages for a Start Farming button
        let targetMsg = null;
        let startBtn = null;

        for (const msg of messages.values()) {
          const btn = findButton(msg, ['start farming', 'start_farming', 'farming', 'start']);
          if (btn) {
            targetMsg = msg;
            startBtn = btn;
            break;
          }
        }

        if (targetMsg && startBtn && !startBtn.disabled) {
          console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Found 'Start Farming' button on message ${targetMsg.id}! Clicking...`);
          const resMsg = await clickStartFarmingButton(selfClient, startChannel, targetMsg, startBtn);
          if (resMsg && !capturedThreadId) {
            const resStr = typeof resMsg === 'string' ? resMsg : JSON.stringify(resMsg);
            const match = resStr.match(/Your farm is ready:\s*<#(\d+)>/i) || resStr.match(/<#(\d+)>/);
            if (match && match[1]) {
              capturedThreadId = match[1];
              console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Captured new thread ID <#${capturedThreadId}> from clickButton response!`);
            }
          }
        } else {
          console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: 'Start Farming' message not found yet in channel. Retrying...`);
        }
      }

      if (!capturedThreadId) {
        await new Promise(resolve => setTimeout(resolve, 4000));
      }
    }

    selfClient.removeListener('threadCreate', threadCreateListener);
    selfClient.removeListener('messageCreate', messageListener);
    if (selfClient.ws) selfClient.ws.removeListener('raw', rawListener);

    if (capturedThreadId) {
      const dispName = selfClient.user?.displayName || selfClient.user?.globalName || selfClient.user?.username || selfClient.user?.tag || 'Selfbot';
      db.addOrUpdateSelfbot(token, capturedThreadId, userId, dispName);
      console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Updated database with new Thread ID <#${capturedThreadId}>.`);

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

      // Resume profile scheduler with new thread ID
      scheduleProfileCommand(selfClient, token, capturedThreadId, activeSelfbots);

      // Execute startup check immediately on recovered thread!
      console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Triggering startup check on newly recovered thread <#${capturedThreadId}>...`);
      if (typeof performThreadStartupCheck === 'function') {
        await performThreadStartupCheck(selfClient, capturedThreadId, mainClient);
      }
    } else {
      console.warn(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Timed out waiting for Gamebot to send new thread ID.`);
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
