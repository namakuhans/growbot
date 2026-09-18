const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const rootEnvPath = path.resolve(__dirname, '..', '.env');
const cwdEnvPath = path.resolve(process.cwd(), '.env');
const srcEnvPath = path.resolve(__dirname, '.env');

if (fs.existsSync(rootEnvPath)) {
  dotenv.config({ path: rootEnvPath, override: true });
} else if (fs.existsSync(cwdEnvPath)) {
  dotenv.config({ path: cwdEnvPath, override: true });
} else if (fs.existsSync(srcEnvPath)) {
  dotenv.config({ path: srcEnvPath, override: true });
} else {
  dotenv.config({ override: true });
}

const botToken = (process.env.DISCORD_BOT_TOKEN || '').trim().replace(/^["']|["']$/g, '');
if (botToken && botToken !== 'your_bot_token_here') {
  process.env.DISCORD_BOT_TOKEN = botToken;
} else {
  delete process.env.DISCORD_BOT_TOKEN;
}
const { Client, GatewayIntentBits, REST, Routes, Options, Events } = require('discord.js');

const { setCommand } = require('./commands/setCommand');
const { resetCommand } = require('./commands/resetCommand');
const { licenseCommand } = require('./commands/licenseCommand');
const { unlicenseCommand } = require('./commands/unlicenseCommand');
const { whitelistCommand } = require('./commands/whitelistCommand');
const { unwhitelistCommand } = require('./commands/unwhitelistCommand');
const { handleInteraction } = require('./handlers/interactionHandler');
const { startLicenseChecker } = require('./services/licenseService');
const { updateActivePanel, updateMainBotRPC } = require('./services/panelService');
const { updateAllUserDmPanels } = require('./services/dmService');
const { loadAndStartAllSelfbots } = require('./services/selfbotService');
const { startDashboardServer } = require('./services/dashboardService');
const { autoGrantRoleLicense } = require('./services/roleLicenseService');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages
  ],
  makeCache: Options.cacheWithLimits({
    MessageManager: 0,
    PresenceManager: 0,
    ReactionManager: 0,
    ThreadMemberManager: 0,
    GuildBanManager: 0,
    GuildInviteManager: 0,
    GuildStickerManager: 0,
    GuildScheduledEventManager: 0,
    AutoModerationRuleManager: 0,
    VoiceStateManager: 0,
    StageInstanceManager: 0
  }),
  sweepers: {
    messages: {
      interval: 300,
      lifetime: 60
    }
  }
});

client.once(Events.ClientReady, async () => {
  console.log(`[MAIN BOT] Logged in as ${client.user.tag}`);

  const db = require('./database/db');
  await db.ensureDb();

  try {
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: [setCommand.toJSON(), resetCommand.toJSON(), licenseCommand.toJSON(), unlicenseCommand.toJSON(), whitelistCommand.toJSON(), unwhitelistCommand.toJSON()] }
    );
    console.log('[MAIN BOT] Slash command /set successfully registered globally.');
  } catch (cmdErr) {
    console.error('[MAIN BOT] Failed to register slash command:', cmdErr);
  }

  updateMainBotRPC(client);
  await loadAndStartAllSelfbots(client);
  await updateActivePanel(client);
  await updateAllUserDmPanels(client);
  startLicenseChecker(client, 30000);
});

// Start web dashboard management server with Discord Client reference
startDashboardServer(client);

client.on('interactionCreate', handleInteraction);

// Auto-grant permanent license to members who already have ROLE_ID when they join
client.on('guildMemberAdd', (member) => {
  try {
    autoGrantRoleLicense(member, member.id);
  } catch (e) {}
});

// Also auto-grant when a role is added to an existing member
client.on('guildMemberUpdate', (oldMember, newMember) => {
  try {
    const roleId = (process.env.ROLE_ID || '').trim();
    if (!roleId) return;
    // Only act when the role was just added (not removed)
    if (!oldMember.roles.cache.has(roleId) && newMember.roles.cache.has(roleId)) {
      autoGrantRoleLicense(newMember, newMember.id);
    }
  } catch (e) {}
});

if (process.env.DISCORD_BOT_TOKEN) {
  client.login(process.env.DISCORD_BOT_TOKEN);
} else {
  console.log('[MAIN BOT] No DISCORD_BOT_TOKEN found in environment. System modules ready.');
}

module.exports = client;
