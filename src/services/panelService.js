const {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  ButtonBuilder,
  ButtonStyle,
  ThumbnailBuilder,
  MessageFlags
} = require('discord.js');
const db = require('../database/db');
const { BANNER_URL, getDynamicFooterText } = require('../config/constants');

function createPanelComponents(client) {
  const stats = db.getStats();
  const selfbots = db.getSelfbots();

  const lastResolveDisplay = stats.lastResolve
    ? `<t:${stats.lastResolve}:R>`
    : 'No activity recorded yet';

  const botAvatar = client.user?.displayAvatarURL({ dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png';

  // Section 1: Title & System Overview
  const sec1Text = new TextDisplayBuilder()
    .setContent('# GROWCORD AUTOMATED CONTROL PANEL\nWelcome to the official Growcord Automated Management System. This control center provides real-time monitoring and automated orchestration for your selfbot accounts, ensuring continuous anti-AFK verification, automated lock conversions (BGL / DL / WL), and intelligent stock replenishment (< 100 blocks).');

  const sec1 = new SectionBuilder()
    .addTextDisplayComponents(sec1Text)
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatar));

  // Section 2: Account Authentication & Portal Access
  const sec2Text = new TextDisplayBuilder()
    .setContent('### 🔐 Account Authentication Portal\nAuthenticate your selfbot session by clicking the **Login** button below. Simply provide your User Token and target Thread ID to activate automated anti-AFK responses and stock management routines.');

  const loginBtn = new ButtonBuilder()
    .setCustomId('btn_login_selfbot')
    .setLabel('Login')
    .setStyle(ButtonStyle.Success)
    .setEmoji('🔑');

  const sec2 = new SectionBuilder()
    .addTextDisplayComponents(sec2Text)
    .setButtonAccessory(loginBtn);

  // Section 3: Operational Metrics & Telemetry
  const sec3Text = new TextDisplayBuilder()
    .setContent(`### 📊 System Telemetry & Statistics\n**Active Selfbot Sessions:** ${selfbots.length} Accounts\n**Anti-AFK Verification Resolved:** ${stats.totalResolved} Operations\n**Last Activity Timestamp:** ${lastResolveDisplay}`);

  // Section 4: Image Banner
  const galleryItem = new MediaGalleryItemBuilder().setURL(BANNER_URL);
  const mediaGallery = new MediaGalleryBuilder().addItems(galleryItem);

  // Section 5: Footer (Dynamic real-time WIB timestamp)
  const secFooterText = new TextDisplayBuilder()
    .setContent(getDynamicFooterText());

  // Build Container (ComponentV2)
  const container = new ContainerBuilder()
    .setAccentColor(0x37FF00)
    .addSectionComponents(sec1)
    .addSeparatorComponents(new SeparatorBuilder())
    .addSectionComponents(sec2)
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(sec3Text)
    .addSeparatorComponents(new SeparatorBuilder())
    .addMediaGalleryComponents(mediaGallery)
    .addSeparatorComponents(new SeparatorBuilder())
    .addTextDisplayComponents(secFooterText);

  return { components: [container], flags: MessageFlags.IsComponentsV2 || (1 << 15) };
}

async function updateActivePanel(client) {
  try {
    const { channelId, messageId } = db.getPanel();
    if (!channelId || !messageId) return;

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel) return;

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) return;

    const panelData = createPanelComponents(client);
    await message.edit(panelData).catch(() => null);
  } catch (err) {
    console.error('Failed to update active panel:', err);
  }
}

function updateMainBotRPC(client) {
  try {
    const accountCount = db.getSelfbots().length;
    const resolvedCount = db.getStats().totalResolved;

    client.user.setActivity(`${accountCount} akun | ${resolvedCount} resolved`, {
      type: 3 // ActivityType.Watching = 3
    });
  } catch (err) {
    console.error('Failed to update Main Bot RPC:', err);
  }
}

module.exports = {
  createPanelComponents,
  updateActivePanel,
  updateMainBotRPC
};
