const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, StringSelectMenuBuilder, PermissionsBitField } = require('discord.js');
const { getModPermissions } = require('../utils/permissions');
const { createClient } = require('@supabase/supabase-js');
const supabase = require('../supabaseClient');

module.exports = {
  name: 'reactrole',
  async execute(message, args, client) {
    const { isMod, errorEmbed } = await getModPermissions(message, supabase);
    if (!isMod) return message.reply({ embeds: [errorEmbed], ephemeral: true });

    const targetChannel = message.mentions.channels.first();
    if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
      return message.reply('Please mention a valid text channel.');
    }

    // Step 1: Ask for message text
    const embed = new EmbedBuilder()
      .setTitle('Reaction Role Setup')
      .setDescription('Please reply with the message text for the reaction role.')
      .setColor(0x3498db);

    await message.reply({ embeds: [embed] });

    const textFilter = m => m.author.id === message.author.id;
    const collectedText = await message.channel.awaitMessages({ filter: textFilter, max: 1, time: 30000 });
    if (!collectedText.size) return message.reply('Timeout. No message text received.');

    const messageText = collectedText.first().content;

    // Step 2: Ask for toggle mode
    const toggleEmbed = new EmbedBuilder()
      .setTitle('Togglable Reaction Role?')
      .setDescription('Should selecting the emoji again remove the role? Click a button below.')
      .setColor(0x2ecc71);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('toggle_on').setLabel('Yes').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('toggle_off').setLabel('No').setStyle(ButtonStyle.Danger)
    );

    const toggleMsg = await message.channel.send({ embeds: [toggleEmbed], components: [row] });

    const toggleInteraction = await toggleMsg.awaitMessageComponent({ time: 30000 });
    const togglable = toggleInteraction.customId === 'toggle_on';
    await toggleInteraction.update({ content: `Toggle mode set to: ${togglable ? 'ON' : 'OFF'}`, components: [] });

    // Step 3: Ask for emoji-role mappings
    const mappings = {};
    const addEmbed = new EmbedBuilder()
      .setTitle('Add Reaction Roles')
      .setDescription('Reply with: `emoji @role` (one per message). Type `done` when finished.')
      .setColor(0xf1c40f);

    await message.channel.send({ embeds: [addEmbed] });

    const roleCollector = message.channel.createMessageCollector({ filter: textFilter, time: 120000 });

    roleCollector.on('collect', msg => {
      if (msg.content.toLowerCase() === 'done') return roleCollector.stop();

      const parts = msg.content.trim().split(/\s+/);
      const emoji = parts[0];
      const role = msg.mentions.roles.first();

      if (!emoji || !role) {
        msg.reply('Invalid format. Use: `emoji @role`');
        return;
      }

      mappings[emoji] = role.id;
      msg.react('✅');
    });

    roleCollector.on('end', async () => {
      if (Object.keys(mappings).length === 0) {
        return message.reply('No roles added. Cancelling setup.');
      }

      // Step 4: Send the reaction role message
      const post = await targetChannel.send(messageText);

      for (const emoji of Object.keys(mappings)) {
        try {
          await post.react(emoji);
        } catch (err) {
          console.warn(`Failed to react with emoji ${emoji}`, err);
        }
      }

      // Save to Supabase
      const { error } = await supabase.from('reaction_roles').insert({
        guild_id: message.guild.id,
        channel_id: targetChannel.id,
        message_id: post.id,
        roles: mappings,
        togglable: togglable,
      });

      if (error) {
        console.error('Failed to save reaction role message:', error);
        return message.reply('Saved message failed. Please try again.');
      }

      return message.reply('Reaction role message successfully created and saved!');
    });
  },
};
