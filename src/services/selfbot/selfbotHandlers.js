const db = require('../../database/db');
const { GAMEBOT_ID, APPLICATION_ID } = require('../../config/constants');
const { parseFarmableInfo, extractButtons, getHumanDelay } = require('./parsers');
const { executeAutoBuyFlow, isAutoBuying } = require('./autoBuy');
const { startFarmingOnMainPanel, navigateToFarmingMenu } = require('./autoBuyHelpers');
const { notifyInvalidThreadWebhook } = require('./webhookNotifier');

/**
 * Creates a farming guard closure for a selfbot client to prevent concurrent farm triggers.
 *
 * @param {Client} selfClient
 * @returns {{ startFarmingIfNeeded: Function }}
 */
function createFarmingGuard(selfClient) {
  let isTriggeringFarm = false;

  async function startFarmingIfNeeded(gamebotMsg, sourceLabel) {
    // Do not interfere if auto-buy is currently running
    const clientKey = selfClient.user?.id || selfClient.token || 'default';
    if (isTriggeringFarm || isAutoBuying(clientKey)) return;

    const { toggleAutoFarmButton, farmButton } = extractButtons(gamebotMsg);

    const isToggleRed = toggleAutoFarmButton && (
      toggleAutoFarmButton.style === 4 ||
      toggleAutoFarmButton.style === 'DANGER' ||
      toggleAutoFarmButton.style === 'Danger'
    );
    const isFarmDisabled = farmButton && (farmButton.disabled === true || farmButton.disabled === 'true');

    // Toggle RED + Farm DISABLED → farming already running, skip
    if (isToggleRed && isFarmDisabled) return;

    // No actionable buttons found
    if (!toggleAutoFarmButton && !farmButton) return;

    // Set guard synchronously before any await to prevent race conditions
    isTriggeringFarm = true;

    try {
      console.log(`[SELFBOT ${sourceLabel}] ${selfClient.user?.tag || 'Selfbot'}: Blocks >= 100 but farming not active. Starting farming...`);
      await startFarmingOnMainPanel(gamebotMsg.channel, gamebotMsg, selfClient.user?.tag || 'Selfbot');
    } finally {
      setTimeout(() => { isTriggeringFarm = false; }, 3000);
    }
  }

  return { startFarmingIfNeeded };
}

/**
 * Sets up the 15-second background interval to verify thread validity,
 * unwind sub-menus back to farming menu, and check block counts.
 *
 * @param {Client} selfClient
 * @param {string} token
 * @param {string} threadId
 * @param {string} userId
 * @param {Client} [mainClient]
 * @param {Map} activeSelfbots
 * @param {Function} startFarmingIfNeeded
 * @param {Function} performThreadStartupCheck
 * @returns {NodeJS.Timeout}
 */
function setupPeriodicAutoBuyCheck(
  selfClient,
  token,
  threadId,
  userId,
  mainClient,
  activeSelfbots,
  startFarmingIfNeeded,
  performThreadStartupCheck
) {
  return setInterval(async () => {
    try {
      if (!selfClient.isReady()) return;
      const currentSbData = db.getSelfbotByToken(token);
      const targetThreadId = currentSbData ? currentSbData.threadId : threadId;
      if (!targetThreadId) {
        return;
      }

      const channel = await selfClient.channels.fetch(targetThreadId).catch(() => null);
      if (!channel) {
        // Thread ID is invalid or deleted
        console.warn(`[SELFBOT PERIODIC CHECK] ${selfClient.user.tag}: Thread ID <#${targetThreadId}> is invalid or deleted!`);
        await notifyInvalidThreadWebhook(selfClient, token, targetThreadId, userId);
        return;
      }

      const messages = await channel.messages.fetch({ limit: 15, force: true }).catch(() => null);
      if (messages && messages.size > 0) {
        let gamebotMsg = null;
        let farmableInfo = null;

        // Priority 1: Message containing valid farmableInfo
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
          const isBot = m => (m.author && (m.author.id === GAMEBOT_ID || m.author.id === APPLICATION_ID || m.author.bot)) || m.applicationId === APPLICATION_ID || m.applicationId === GAMEBOT_ID;
          gamebotMsg = messages.find(m => isBot(m));
          if (gamebotMsg) farmableInfo = parseFarmableInfo(gamebotMsg);
        }

        const clientKey = selfClient.user ? selfClient.user.id : '';
        const autoBuyActive = isAutoBuying(clientKey);

        // If panel is on sub-menu AND auto-buy is NOT running, try to navigate back
        if (gamebotMsg && !farmableInfo && !autoBuyActive) {
          const navRes = await navigateToFarmingMenu(channel, selfClient, 4);
          if (navRes && navRes.onFarmingMenu) {
            gamebotMsg = navRes.message;
            farmableInfo = navRes.farmableInfo || parseFarmableInfo(gamebotMsg);
          }
        }

        if (gamebotMsg && farmableInfo && typeof farmableInfo.blockCount === 'number') {
          if (farmableInfo.blockCount < 100) {
            // Only trigger auto-buy if not already running
            if (!autoBuyActive) {
              console.log(`[SELFBOT PERIODIC AUTO-BUY CHECK] ${selfClient.user.tag}: Block count is ${farmableInfo.blockCount} (< 100). Auto-triggering auto-buy...`);
              executeAutoBuyFlow(selfClient, channel, gamebotMsg, farmableInfo).catch(() => null);
            }
          } else if (!autoBuyActive) {
            // blocks >= 100 and no auto-buy running: ensure auto farming is active
            await startFarmingIfNeeded(gamebotMsg, 'PERIODIC CHECK');
          }
        }
      }
    } catch (periodicErr) {
      // Ignore background check errors
    }
  }, 15000);
}

/**
 * Creates the runtime message event handler for Discord selfbot.
 *
 * @param {Client} selfClient
 * @param {string} token
 * @param {string} threadId
 * @param {Client} [mainClient]
 * @param {Function} startFarmingIfNeeded
 * @returns {Function}
 */
function createGamebotMessageHandler(selfClient, token, threadId, mainClient, startFarmingIfNeeded) {
  return async function processGamebotMessage(rawMessage) {
    try {
      if (!rawMessage) return;

      let message = rawMessage;
      if (message.partial || !message.author) {
        message = await rawMessage.fetch().catch(() => rawMessage);
      }

      const currentSbData = db.getSelfbotByToken(token);
      const targetThreadId = currentSbData ? currentSbData.threadId : threadId;

      const msgChannelId = message.channelId || (message.channel ? message.channel.id : null);
      if (msgChannelId !== targetThreadId) {
        return;
      }

      const isBot = (message.author && (message.author.id === GAMEBOT_ID || message.author.id === APPLICATION_ID || message.author.bot)) || message.applicationId === APPLICATION_ID || message.applicationId === GAMEBOT_ID;
      if (!isBot && !parseFarmableInfo(message)) {
        return;
      }

      const contentLower = (message.content || '').toLowerCase();
      const mentionsSelf = selfClient.user && message.content && (message.content.includes(`<@${selfClient.user.id}>`) || message.content.includes(`<@!${selfClient.user.id}>`));
      const hasAfkText = contentLower.includes('are you still there') || contentLower.includes('afk verification') || contentLower.includes('afk check');
      const { keepFarmingButton } = extractButtons(message);

      const isAfkPrompt = (hasAfkText || keepFarmingButton !== null) && (mentionsSelf || hasAfkText || keepFarmingButton !== null);

      // 1. Respond if this message is an AFK verification prompt
      if (isAfkPrompt) {
        await new Promise(resolve => setTimeout(resolve, getHumanDelay()));

        let clicked = false;
        if (keepFarmingButton && !keepFarmingButton.disabled) {
          const res = await message.clickButton(keepFarmingButton.customId || keepFarmingButton.id).catch(() => null);
          if (res !== null) clicked = true;
        } else if (message.components && message.components[0]?.components[0]) {
          const firstBtn = message.components[0].components[0];
          if (!firstBtn.disabled) {
            const res = await message.clickButton(firstBtn.customId || firstBtn.id).catch(() => null);
            if (res !== null) clicked = true;
          }
        }

        if (clicked) {
          console.log(`[SELFBOT] ${selfClient.user?.tag || 'Selfbot'} successfully resolved AFK prompt in thread ${targetThreadId}!`);
          db.incrementResolved();

          if (mainClient) {
            try {
              const { updateActivePanel, updateMainBotRPC } = require('../panelService');
              updateActivePanel(mainClient);
              updateMainBotRPC(mainClient);
            } catch (e) {}
          }
        }
        return;
      }

      // 2. Runtime check: blocks < 100 → auto-buy, blocks >= 100 → ensure farming active
      const farmableInfo = parseFarmableInfo(message);
      if (farmableInfo && typeof farmableInfo.blockCount === 'number') {
        if (farmableInfo.blockCount < 100 && !isAutoBuying(selfClient.user ? selfClient.user.id : '')) {
          console.log(`[SELFBOT RUNTIME] Detected block count ${farmableInfo.blockCount} (< 100) on message update/create. Triggering auto-buy...`);
          executeAutoBuyFlow(selfClient, message.channel, message, farmableInfo).catch(() => null);
        } else if (farmableInfo.blockCount >= 100) {
          await startFarmingIfNeeded(message, 'RUNTIME');
        }
      }
    } catch (err) {
      console.error(`[SELFBOT MESSAGE HANDLER ERROR] ${selfClient.user?.tag || 'Selfbot'}:`, err);
    }
  };
}

module.exports = {
  createFarmingGuard,
  setupPeriodicAutoBuyCheck,
  createGamebotMessageHandler
};
