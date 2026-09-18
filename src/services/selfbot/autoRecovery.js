const db = require('../../database/db');
const { FARM_START_CHANNEL_ID } = require('../../config/constants');
const { scheduleProfileCommand } = require('./profileScheduler');
const { clickStartFarmingButton, findStartFarmingButton } = require('./startFarmingInteraction');

const autoRecoveryState = new Map();

/**
 * Triggers automated thread recovery when a thread ID is deleted, invalid,
 * or the Gamebot session needs to be recreated in the start farming channel.
 *
 * @param {Client} selfClient
 * @param {string} token
 * @param {string} userId
 * @param {Client} [mainClient]
 * @param {Map} activeSelfbots
 * @param {Function} [performThreadStartupCheck]
 */
async function triggerThreadAutoRecovery(selfClient, token, userId, mainClient, activeSelfbots, performThreadStartupCheck) {
  if (autoRecoveryState.get(token)) return;
  autoRecoveryState.set(token, true);

  console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Thread ID became invalid. Triggering 'Start Farming' recovery in channel ${FARM_START_CHANNEL_ID}...`);

  try {
    let startChannel = await selfClient.channels.fetch(FARM_START_CHANNEL_ID).catch((err) => {
      console.warn(`[SELFBOT AUTO-RECOVERY] Direct fetch for channel ${FARM_START_CHANNEL_ID} returned: ${err?.message || err}`);
      return null;
    });

    // Fallback 1: search across guilds cache
    if (!startChannel && selfClient.guilds?.cache) {
      for (const guild of selfClient.guilds.cache.values()) {
        startChannel = await guild.channels.fetch(FARM_START_CHANNEL_ID).catch(() => null);
        if (startChannel) break;
      }
    }

    // Fallback 2: fetch via default guild
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

    // ── Listener 2: messageCreate — "Your farm is ready: <#id>" ────────────────
    const messageListener = async (msg) => {
      try {
        if (!msg || capturedThreadId) return;
        const content = typeof msg === 'string' ? msg : (msg.content || '');
        const match = content.match(/Your farm is ready:\s*<#(\d+)>/i);
        if (match && match[1]) {
          capturedThreadId = match[1];
          console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Captured new thread ID <#${capturedThreadId}> from Gamebot message.`);
        }
      } catch (e) {}
    };

    // ── Listener 3: raw gateway — "Your farm is ready: <#id>" (ephemeral packet) ─
    const rawListener = async (packet) => {
      try {
        if (!packet || capturedThreadId) return;
        const data = packet.d;
        if (!data) return;

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

      let messages = null;
      try {
        messages = await startChannel.messages.fetch({ limit: 50 });
      } catch (err) {
        console.warn(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: Error fetching messages in channel ${FARM_START_CHANNEL_ID}:`, err?.message || err);
      }

      // Also fetch pinned messages
      let pinnedMessages = null;
      try {
        pinnedMessages = await startChannel.messages.fetchPinned().catch(() => null);
      } catch (e) {}

      const candidateMessages = [];
      if (messages && messages.size > 0) candidateMessages.push(...messages.values());
      if (pinnedMessages && pinnedMessages.size > 0) {
        for (const pMsg of pinnedMessages.values()) {
          if (!candidateMessages.some(m => m.id === pMsg.id)) {
            candidateMessages.push(pMsg);
          }
        }
      }

      let targetMsg = null;
      let startBtn = null;

      for (const msg of candidateMessages) {
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
        console.log(`[SELFBOT AUTO-RECOVERY] ${selfClient.user?.tag || 'Selfbot'}: 'Start Farming' button not found yet in channel ${FARM_START_CHANNEL_ID} (${candidateMessages.length} candidate messages checked). Retrying in 4s...`);
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
