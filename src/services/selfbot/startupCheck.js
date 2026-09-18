const db = require('../../database/db');
const { GAMEBOT_ID, APPLICATION_ID } = require('../../config/constants');
const { parseFarmableInfo, findButton, extractButtons, getHumanDelay } = require('./parsers');
const { executeAutoBuyFlow } = require('./autoBuy');
const { startFarmingOnMainPanel, navigateToFarmingMenu } = require('./autoBuyHelpers');

async function performThreadStartupCheck(selfClient, targetThreadId, mainClient) {
  try {
    const channel = targetThreadId ? await selfClient.channels.fetch(targetThreadId).catch(() => null) : null;
    if (!channel) {
      console.warn(`[SELFBOT STARTUP CHECK] ${selfClient.user?.tag || 'Selfbot'}: Thread <#${targetThreadId}> unavailable or empty. Triggering auto-recovery...`);
      const { triggerThreadAutoRecovery } = require('./autoRecovery');
      const allSelfbots = db.getSelfbots() || [];
      const sbData = allSelfbots.find(s => s.threadId === targetThreadId) || db.getSelfbotByToken(selfClient.token);
      const token = sbData ? sbData.token : (selfClient.token || '');
      const userId = sbData ? sbData.userId : '';
      const { activeSelfbots } = require('../selfbotService');
      triggerThreadAutoRecovery(selfClient, token, userId, mainClient, activeSelfbots, performThreadStartupCheck).catch(() => null);
      return;
    }

    let gamebotMsg = null;
    let farmableInfo = null;
    let attempts = 0;
    const maxAttempts = 5;

    // Polling loop: keep polling until a Gamebot message containing valid farmableInfo is found
    while (!farmableInfo && attempts < maxAttempts) {
      attempts++;
      console.log(`[SELFBOT STARTUP CHECK] ${selfClient.user?.tag || 'Selfbot'}: Polling thread <#${targetThreadId}> for Gamebot message with Farmable Info (Attempt ${attempts}/${maxAttempts})...`);

      const messages = await channel.messages.fetch({ limit: 25, force: true }).catch(() => null);
      if (messages && messages.size > 0) {
        // Priority 1: Check for message with valid farmableInfo
        for (const msg of messages.values()) {
          const parsed = parseFarmableInfo(msg);
          if (parsed) {
            gamebotMsg = msg;
            farmableInfo = parsed;
            break;
          }
        }

        // Priority 2: Message from Gamebot / Application
        if (!gamebotMsg) {
          const isBotMessage = m => (m.author && (m.author.id === GAMEBOT_ID || m.author.id === APPLICATION_ID || m.author.bot)) || m.applicationId === APPLICATION_ID || m.applicationId === GAMEBOT_ID;
          gamebotMsg = messages.find(m => isBotMessage(m) && m.components && m.components.length > 0) || messages.find(m => isBotMessage(m));
        }
      }

      if (!farmableInfo && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Case A: No Gamebot message found in thread at all! Trigger Thread Auto Recovery!
    if (!gamebotMsg) {
      console.warn(`[SELFBOT STARTUP CHECK] ${selfClient.user?.tag || 'Selfbot'}: No Gamebot message found in thread <#${targetThreadId}> after ${maxAttempts} attempts. Triggering Thread Auto Recovery...`);
      const { triggerThreadAutoRecovery } = require('./autoRecovery');
      const allSelfbots = db.getSelfbots() || [];
      const sbData = allSelfbots.find(s => s.threadId === targetThreadId) || db.getSelfbotByToken(selfClient.token);
      const token = sbData ? sbData.token : (selfClient.token || '');
      const userId = sbData ? sbData.userId : '';
      const { activeSelfbots } = require('../selfbotService');
      triggerThreadAutoRecovery(selfClient, token, userId, mainClient, activeSelfbots, performThreadStartupCheck).catch(() => null);
      return;
    }

    // Case B: Gamebot message found, but farmableInfo is null (panel is on a sub-panel anywhere: Shop, Locks, Profile, Change, Settings, etc.)
    if (!farmableInfo && gamebotMsg) {
      console.warn(`[SELFBOT STARTUP CHECK] ${selfClient.user?.tag || 'Selfbot'}: Panel in thread <#${targetThreadId}> is on a sub-panel. Attempting to unwind navigation back to Farming Menu...`);

      // Acquire temporary auto-buy lock to prevent concurrent message handler interference
      const { stateMap } = require('./autoBuyHelpers');
      const clientKey = selfClient.user?.id || selfClient.token || 'default';
      const hadLock = stateMap.has(clientKey);
      if (!hadLock) stateMap.set(clientKey, { active: true, startTime: Date.now() });

      try {
        const navRes = await navigateToFarmingMenu(channel, selfClient, 6);
        if (navRes && navRes.onFarmingMenu) {
          gamebotMsg = navRes.message;
          farmableInfo = navRes.farmableInfo || parseFarmableInfo(gamebotMsg);
          console.log(`[SELFBOT STARTUP CHECK] ${selfClient.user?.tag || 'Selfbot'}: Successfully unwound back to Main Farming Menu (Blocks: ${farmableInfo?.blockCount ?? 'Unknown'}).`);
        } else {
          console.warn(`[SELFBOT STARTUP CHECK] ${selfClient.user?.tag || 'Selfbot'}: Unable to navigate to Farming Menu after unwinding. Triggering Thread Auto Recovery...`);
          const { triggerThreadAutoRecovery } = require('./autoRecovery');
          const allSelfbots = db.getSelfbots() || [];
          const sbData = allSelfbots.find(s => s.threadId === targetThreadId) || db.getSelfbotByToken(selfClient.token);
          const token = sbData ? sbData.token : (selfClient.token || '');
          const userId = sbData ? sbData.userId : '';
          const { activeSelfbots } = require('../selfbotService');
          triggerThreadAutoRecovery(selfClient, token, userId, mainClient, activeSelfbots, performThreadStartupCheck).catch(() => null);
          return;
        }
      } finally {
        // Release lock if we set it (allow auto-buy to proceed normally)
        if (!hadLock) stateMap.delete(clientKey);
      }
    }

    console.log(`[SELFBOT STARTUP] ${selfClient.user?.tag || 'Selfbot'} Farmable Info:`, farmableInfo);

    const contentLower = (gamebotMsg.content || '').toLowerCase();
    const selfUserId = selfClient.user?.id;
    const mentionsSelf = selfUserId && gamebotMsg.content && (gamebotMsg.content.includes(`<@${selfUserId}>`) || gamebotMsg.content.includes(`<@!${selfUserId}>`));
    const hasAfkText = contentLower.includes('are you still there') || contentLower.includes('afk verification') || contentLower.includes('afk check');
    const { keepFarmingButton, toggleAutoFarmButton, farmButton } = extractButtons(gamebotMsg);

    const isAfkPrompt = (hasAfkText || keepFarmingButton !== null) && (mentionsSelf || hasAfkText || keepFarmingButton !== null);

    // 1. If AFK prompt exists on startup, resolve it
    if (isAfkPrompt) {
      await new Promise(resolve => setTimeout(resolve, getHumanDelay()));
      let clicked = false;
      if (keepFarmingButton && !keepFarmingButton.disabled) {
        const res = await gamebotMsg.clickButton(keepFarmingButton.customId || keepFarmingButton.id).catch(() => null);
        if (res !== null) clicked = true;
      } else if (gamebotMsg.components && gamebotMsg.components[0]?.components[0]) {
        const firstBtn = gamebotMsg.components[0].components[0];
        if (!firstBtn.disabled) {
          const res = await gamebotMsg.clickButton(firstBtn.customId || firstBtn.id).catch(() => null);
          if (res !== null) clicked = true;
        }
      }

      if (clicked) {
        console.log(`[SELFBOT STARTUP] ${selfClient.user?.tag || 'Selfbot'} resolved AFK prompt in thread ${targetThreadId}`);
        db.incrementResolved();
        if (mainClient) {
          try {
            const { updateActivePanel, updateMainBotRPC } = require('../panelService');
            updateActivePanel(mainClient);
            updateMainBotRPC(mainClient);
          } catch (e) {}
        }
      }
    } else {
      // 2. Check blocks count for auto-buy
      if (farmableInfo && typeof farmableInfo.blockCount === 'number' && farmableInfo.blockCount < 100) {
        await executeAutoBuyFlow(selfClient, channel, gamebotMsg, farmableInfo).catch(() => null);
      } else {
        // Standard initial farm check on startup/redeploy
        await startFarmingOnMainPanel(channel, gamebotMsg, selfClient.user?.tag || 'Selfbot');
      }
    }
  } catch (err) {
    console.error(`[SELFBOT STARTUP CHECK ERROR] ${selfClient.user?.tag || 'Selfbot'}:`, err);
    setTimeout(() => performThreadStartupCheck(selfClient, targetThreadId, mainClient).catch(() => null), 10000);
  }
}

module.exports = {
  performThreadStartupCheck
};
