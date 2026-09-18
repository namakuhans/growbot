const {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ThumbnailBuilder,
  MessageFlags
} = require('discord.js');
const db = require('../database/db');
const { getDynamicFooterText } = require('../config/constants');

const { isSelfbotThreadValid } = require('./selfbotService');
const { formatProxyDisplay } = require('./selfbot/proxyHelper');

async function createUserDMManagementComponents(user) {
  const userSelfbots = db.getSelfbotsByUser(user.id);

  const headerText = new TextDisplayBuilder()
    .setContent('# ⚙️ Selfbot Management\nHere is the list of selfbot accounts linked to your Discord account.');

  const userAvatar = user.displayAvatarURL({ dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png';
  const headerSection = new SectionBuilder()
    .addTextDisplayComponents(headerText)
    .setThumbnailAccessory(new ThumbnailBuilder().setURL(userAvatar));

  const container = new ContainerBuilder()
    .setAccentColor(0x37FF00)
    .addSectionComponents(headerSection);

  if (userSelfbots.length === 0) {
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### ⚠️ No Registered Selfbots\nYou have not registered any selfbot accounts yet. Please click the **Login** button on the server control panel.')
    );
  } else {
    for (const sb of userSelfbots) {
      container.addSeparatorComponents(new SeparatorBuilder());

      const validThread = await isSelfbotThreadValid(sb.token, sb.threadId);
      const statusText = validThread ? 'Status: On🟢' : 'Status: Thread Invalid 🔴';

      const sbText = new TextDisplayBuilder()
        .setContent(`**Account:** ${sb.displayName}\n**Thread:** <#${sb.threadId}>\n**Proxy:** ${formatProxyDisplay(sb.proxy)}\n**${statusText}**`);

      const changeThreadBtn = new ButtonBuilder()
        .setCustomId(`btn_change_thread_${sb.token}`)
        .setLabel('Change Thread')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('✏️');

      const sbSec = new SectionBuilder()
        .addTextDisplayComponents(sbText)
        .setButtonAccessory(changeThreadBtn);

      container.addSectionComponents(sbSec);
    }

    container.addSeparatorComponents(new SeparatorBuilder());

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('select_logout_selfbot')
      .setPlaceholder('🚪 Select a selfbot account to Logout...');

    userSelfbots.forEach(sb => {
      selectMenu.addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel(`Logout: ${sb.displayName}`)
          .setDescription(`Thread: ${sb.threadId}`)
          .setValue(sb.token)
          .setEmoji('🗑️')
      );
    });

    container.addActionRowComponents(new ActionRowBuilder().addComponents(selectMenu));
  }

  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(getDynamicFooterText())
  );

  return { components: [container], flags: MessageFlags.IsComponentsV2 || (1 << 15) };
}

async function sendOrUpdateUserDM(user, client) {
  try {
    const dmComponents = await createUserDMManagementComponents(user);
    const existingDmPointer = db.getUserDmPanel(user.id);

    // Get or create DM channel for the user
    const dmChannel = user.dmChannel || await user.createDM().catch(() => null);

    if (dmChannel) {
      // 1. Try editing via stored message ID
      if (existingDmPointer && existingDmPointer.messageId) {
        const message = await dmChannel.messages.fetch(existingDmPointer.messageId).catch(() => null);
        if (message) {
          await message.edit(dmComponents);
          return message;
        }
      }

      // 2. Fallback: Search recent messages in DM channel for existing panel
      const recentMessages = await dmChannel.messages.fetch({ limit: 10 }).catch(() => null);
      if (recentMessages && (recentMessages.size > 0 || (Array.isArray(recentMessages) && recentMessages.length > 0))) {
        const botId = client?.user?.id;
        const msgArray = Array.isArray(recentMessages) ? recentMessages : Array.from(recentMessages.values());
        const panelMessage = msgArray.find(m =>
          (botId ? m.author?.id === botId : m.author?.bot) &&
          m.components &&
          m.components.length > 0
        );

        if (panelMessage) {
          await panelMessage.edit(dmComponents);
          db.setUserDmPanel(user.id, dmChannel.id, panelMessage.id);
          return panelMessage;
        }
      }
    }

    // 3. Send new DM message if no existing panel message was found or editable
    const sentMsg = await user.send(dmComponents);
    db.setUserDmPanel(user.id, sentMsg.channelId || sentMsg.channel?.id, sentMsg.id);
    return sentMsg;
  } catch (err) {
    console.error(`Failed to send/update DM for user ${user.id}:`, err);
    return null;
  }
}

async function updateAllUserDmPanels(client) {
  try {
    const userDmPanels = db.getUserDmPanels();

    for (const userId of Object.keys(userDmPanels)) {
      try {
        const user = await client.users.fetch(userId).catch(() => null);
        if (user) {
          await sendOrUpdateUserDM(user, client);
        }
      } catch (userErr) {
        console.error(`Failed to refresh DM panel for user ${userId} on startup:`, userErr);
      }
    }
  } catch (err) {
    console.error('Failed to update all user DM panels on startup:', err);
  }
}

module.exports = {
  createUserDMManagementComponents,
  sendOrUpdateUserDM,
  updateAllUserDmPanels
};
