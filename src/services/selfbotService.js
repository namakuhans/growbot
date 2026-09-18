const { Client: SelfClient, Options } = require('discord.js-selfbot-v13');
const db = require('../database/db');
const { applyPatches } = require('./selfbot/patches');
const { scheduleProfileCommand, clearProfileTimer } = require('./selfbot/profileScheduler');
const { performThreadStartupCheck } = require('./selfbot/startupCheck');
const { triggerThreadAutoRecovery } = require('./selfbot/autoRecovery');
const { applyProxyToClient, resetRestAgentSingleton, parseProxyUrl } = require('./selfbot/proxyHelper');
const {
  activeSelfbots,
  stopSelfbot,
  stopAllSelfbots,
  isSelfbotThreadValid
} = require('./selfbot/selfbotRegistry');
const {
  createFarmingGuard,
  setupPeriodicAutoBuyCheck,
  createGamebotMessageHandler
} = require('./selfbot/selfbotHandlers');

// Apply prototype patches on Message
applyPatches();

/**
 * Initializes and starts a Discord selfbot client.
 *
 * @param {string} token
 * @param {string} threadId
 * @param {string} userId
 * @param {Client} [mainClient]
 * @param {string|null} [proxy] - Optional HTTP/HTTPS proxy URL (e.g. http://user:pass@host:port)
 * @returns {Promise<Client|null>}
 */
async function startSelfbot(token, threadId, userId, mainClient, proxy) {
  if (activeSelfbots.has(token)) {
    try {
      activeSelfbots.get(token).destroy();
    } catch (e) {}
    activeSelfbots.delete(token);
  }

  clearProfileTimer(token);

  // --- Proxy Setup ---
  const resolvedProxy = proxy || db.getSelfbotByToken(token)?.proxy || null;
  if (resolvedProxy) {
    const { masked } = parseProxyUrl(resolvedProxy);
    console.log(`[SELFBOT PROXY] Token ${token.substring(0, 10)}...: Using proxy ${masked}`);
    // Reset REST agent singleton so this selfbot gets a fresh ProxyAgent
    resetRestAgentSingleton();
  } else {
    console.warn(`[SELFBOT PROXY] Token ${token.substring(0, 10)}...: No proxy configured. Running on bare IP. Account ban risk assumed by user.`);
  }

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

  // Apply proxy agents to client before login
  if (resolvedProxy) {
    applyProxyToClient(selfClient, resolvedProxy);
  }

  // Ensure session_id is always captured and cached on the selfbot client
  if (selfClient.ws) {
    selfClient.ws.on('raw', (packet) => {
      if ((packet.t === 'READY' || packet.t === 'RESUMED') && packet.d?.session_id) {
        selfClient._cachedSessionId = packet.d.session_id;
      }
    });
  }

  const { startFarmingIfNeeded } = createFarmingGuard(selfClient);

  selfClient.on('ready', async () => {
    if (selfClient.sessionId) {
      selfClient._cachedSessionId = selfClient.sessionId;
    }
    console.log(`[SELFBOT] Logged in as ${selfClient.user.tag} (${selfClient.user.id})`);

    const dispName = selfClient.user.displayName || selfClient.user.globalName || selfClient.user.username || selfClient.user.tag;
    db.addOrUpdateSelfbot(token, threadId, userId, dispName, resolvedProxy);

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
    selfClient._autoBuyInterval = setupPeriodicAutoBuyCheck(
      selfClient,
      token,
      threadId,
      userId,
      mainClient,
      activeSelfbots,
      startFarmingIfNeeded,
      performThreadStartupCheck,
      triggerThreadAutoRecovery
    );

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

  // Attach message handlers
  const messageHandler = createGamebotMessageHandler(selfClient, token, threadId, mainClient, startFarmingIfNeeded);
  selfClient.on('messageCreate', messageHandler);
  selfClient.on('messageUpdate', async (_, newMessage) => {
    if (newMessage) messageHandler(newMessage);
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

/**
 * Loads all saved selfbots from SQLite database and initializes them.
 *
 * @param {Client} mainClient
 */
async function loadAndStartAllSelfbots(mainClient) {
  const allSelfbots = db.getSelfbots();
  console.log(`[SELFBOT MANAGER] Initializing ${allSelfbots.length} selfbot(s)...`);
  for (const sb of allSelfbots) {
    await startSelfbot(sb.token, sb.threadId, sb.userId, mainClient, sb.proxy || null);
  }
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
