const { Client: SelfClient, Options } = require('discord.js-selfbot-v13');
const db = require('../database/db');
const { GAMEBOT_ID } = require('../config/constants');
const { applyPatches } = require('./selfbot/patches');
const { parseFarmableInfo, extractButtons, getHumanDelay } = require('./selfbot/parsers');
const { scheduleProfileCommand, clearProfileTimer, clearAllProfileTimers } = require('./selfbot/profileScheduler');
const { executeAutoBuyFlow, isAutoBuying } = require('./selfbot/autoBuy');
const { performThreadStartupCheck } = require('./selfbot/startupCheck');
const { triggerThreadAutoRecovery } = require('./selfbot/autoRecovery');

// Apply prototype patches on Message
applyPatches();

const activeSelfbots = new Map();

async function startSelfbot(token, threadId, userId, mainClient) {
  if (activeSelfbots.has(token)) {
    try {
      activeSelfbots.get(token).destroy();
    } catch (e) {}
    activeSelfbots.delete(token);
  }

  clearProfileTimer(token);

  const selfClient = new SelfClient({
    checkUpdate: false,
    makeCache: Options.cacheWithLimits({
      MessageManager: 10,
      PresenceManager: 0,
      ReactionManager: 0,
      ThreadMemberManager: 0,
      GuildBanManager: 0,
      GuildInviteManager: 0,
      GuildStickerManager: 0,
      GuildScheduledEventManager: 0,
      VoiceStateManager: 0,
      StageInstanceManager: 0
    }),
    sweepers: {
      messages: {
        interval: 180,
        lifetime: 30
      }
    }
  });

  selfClient.on('ready', async () => {
    console.log(`[SELFBOT] Logged in as ${selfClient.user.tag} (${selfClient.user.id})`);

    const dispName = selfClient.user.displayName || selfClient.user.globalName || selfClient.user.username || selfClient.user.tag;
    db.addOrUpdateSelfbot(token, threadId, userId, dispName);

    if (mainClient) {
      const { updateActivePanel, updateMainBotRPC } = require('./panelService');
      const { sendOrUpdateUserDM } = require('./dmService');
      updateActivePanel(mainClient);
      updateMainBotRPC(mainClient);

      try {
        mainClient.users.fetch(userId).then(user => {
          if (user) sendOrUpdateUserDM(user, mainClient);
        }).catch(() => null);
      } catch (e) {}
    }

    // Start background automated /profile execution with dynamic 13-20m interval
    scheduleProfileCommand(selfClient, token, threadId, activeSelfbots);

    // Periodic background check (every 15s) to automatically verify thread validity & block count
    const autoBuyInterval = setInterval(async () => {
      try {
        if (!selfClient.isReady()) return;
        const currentSbData = db.getSelfbotByToken(token);
        const targetThreadId = currentSbData ? currentSbData.threadId : threadId;
        if (!targetThreadId) {
          triggerThreadAutoRecovery(selfClient, token, userId, mainClient, activeSelfbots, performThreadStartupCheck).catch(() => null);
          return;
        }

        const channel = await selfClient.channels.fetch(targetThreadId).catch(() => null);
        if (!channel) {
          // Thread ID is invalid or deleted. Trigger auto-recovery!
          console.warn(`[SELFBOT PERIODIC CHECK] ${selfClient.user.tag}: Thread ID <#${targetThreadId}> is invalid or deleted!`);
          triggerThreadAutoRecovery(selfClient, token, userId, mainClient, activeSelfbots, performThreadStartupCheck).catch(() => null);
          return;
        }

        if (isAutoBuying(selfClient.user ? selfClient.user.id : '')) return;

        const messages = await channel.messages.fetch({ limit: 5 }).catch(() => null);
        if (messages && messages.size > 0) {
          const gamebotMsg = messages.find(m => m.author && m.author.id === GAMEBOT_ID);
          if (gamebotMsg) {
            const farmableInfo = parseFarmableInfo(gamebotMsg);
            if (farmableInfo && typeof farmableInfo.blockCount === 'number' && farmableInfo.blockCount < 100) {
              console.log(`[SELFBOT PERIODIC AUTO-BUY CHECK] ${selfClient.user.tag}: Block count is ${farmableInfo.blockCount} (< 100). Auto-triggering auto-buy...`);
              executeAutoBuyFlow(selfClient, channel, gamebotMsg, farmableInfo).catch(() => null);
            }
          }
        }
      } catch (periodicErr) {
        // Ignore background check errors
      }
    }, 15000);

    selfClient._autoBuyInterval = autoBuyInterval;

    // Perform startup/redeploy check once
    try {
      const currentSbData = db.getSelfbotByToken(token);
      const targetThreadId = currentSbData ? currentSbData.threadId : threadId;

      if (!targetThreadId) {
        console.warn(`[SELFBOT STARTUP CHECK] ${selfClient.user.tag}: Selfbot has no initial Thread ID! Triggering auto-recovery...`);
        triggerThreadAutoRecovery(selfClient, token, userId, mainClient, activeSelfbots, performThreadStartupCheck).catch(() => null);
      } else {
        const channel = await selfClient.channels.fetch(targetThreadId).catch(() => null);
        if (!channel) {
          console.warn(`[SELFBOT STARTUP CHECK] ${selfClient.user.tag}: Initial Thread ID <#${targetThreadId}> is invalid or deleted! Triggering auto-recovery...`);
          triggerThreadAutoRecovery(selfClient, token, userId, mainClient, activeSelfbots, performThreadStartupCheck).catch(() => null);
        } else {
          await performThreadStartupCheck(selfClient, targetThreadId, mainClient);
        }
      }
    } catch (startupErr) {
      console.error(`[SELFBOT STARTUP CHECK ERROR] ${selfClient.user.tag}:`, startupErr);
    }
  });

  // Runtime listener responds to AFK verification prompts AND auto-buys blocks if block count drops below 100
  async function processGamebotMessage(rawMessage) {
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

      if (message.author && message.author.id !== GAMEBOT_ID) {
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
              const { updateActivePanel, updateMainBotRPC } = require('./panelService');
              updateActivePanel(mainClient);
              updateMainBotRPC(mainClient);
            } catch (e) {}
          }
        }
        return;
      }

      // 2. Runtime check: Check if message contains farmable info with blocks < 100
      const farmableInfo = parseFarmableInfo(message);
      if (farmableInfo && typeof farmableInfo.blockCount === 'number' && farmableInfo.blockCount < 100 && !isAutoBuying(selfClient.user ? selfClient.user.id : '')) {
        console.log(`[SELFBOT RUNTIME] Detected block count ${farmableInfo.blockCount} (< 100) on message update/create. Triggering auto-buy...`);
        executeAutoBuyFlow(selfClient, message.channel, message, farmableInfo).catch(() => null);
      }
    } catch (err) {
      console.error(`[SELFBOT MESSAGE HANDLER ERROR] ${selfClient.user?.tag || 'Selfbot'}:`, err);
    }
  }

  selfClient.on('messageCreate', processGamebotMessage);
  selfClient.on('messageUpdate', async (_, newMessage) => {
    if (newMessage) processGamebotMessage(newMessage);
  });

  try {
    await selfClient.login(token);
    activeSelfbots.set(token, selfClient);
    return selfClient;
  } catch (loginErr) {
    console.error(`[SELFBOT LOGIN FAILED] Token: ${token.substring(0, 10)}... Error:`, loginErr.message);

    if (mainClient && userId) {
      try {
        const user = await mainClient.users.fetch(userId).catch(() => null);
        if (user) {
          const { EmbedBuilder } = require('discord.js');
          const errEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('⚠️ Gagal Login Selfbot')
            .setDescription(`Token selfbot Anda tidak valid atau telah kadaluarsa.\n\n**Token:** \`${token.substring(0, 15)}...\``)
            .setTimestamp();
          await user.send({ embeds: [errEmbed] }).catch(() => null);
        }
      } catch (dmErr) {}
    }

    db.removeSelfbot(token);
    return null;
  }
}

function stopSelfbot(token) {
  clearProfileTimer(token);
  if (activeSelfbots.has(token)) {
    const sbClient = activeSelfbots.get(token);
    if (sbClient && sbClient._autoBuyInterval) {
      clearInterval(sbClient._autoBuyInterval);
    }
    try {
      sbClient.destroy();
    } catch (e) {}
    activeSelfbots.delete(token);
  }
}

async function loadAndStartAllSelfbots(mainClient) {
  const allSelfbots = db.getSelfbots();
  console.log(`[SELFBOT MANAGER] Initializing ${allSelfbots.length} selfbot(s)...`);
  for (const sb of allSelfbots) {
    await startSelfbot(sb.token, sb.threadId, sb.userId, mainClient);
  }
}

async function isSelfbotThreadValid(token, threadId) {
  const selfClient = activeSelfbots.get(token);
  if (!selfClient || !selfClient.isReady()) return false;

  try {
    const channel = await selfClient.channels.fetch(threadId).catch(() => null);
    if (!channel) return false;
    return true;
  } catch (e) {
    return false;
  }
}

function stopAllSelfbots() {
  clearAllProfileTimers();

  for (const [token, sbClient] of activeSelfbots.entries()) {
    if (sbClient && sbClient._autoBuyInterval) {
      clearInterval(sbClient._autoBuyInterval);
    }
    try {
      sbClient.destroy();
    } catch (e) {}
  }
  activeSelfbots.clear();
}

module.exports = {
  startSelfbot,
  stopSelfbot,
  stopAllSelfbots,
  loadAndStartAllSelfbots,
  isSelfbotThreadValid,
  performThreadStartupCheck,
  triggerThreadAutoRecovery,
  activeSelfbots
};
