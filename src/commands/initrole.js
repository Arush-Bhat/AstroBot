import { SlashCommandBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import supabase from './src/supabaseClient'
import { isAdmin } from '../utils/permissions';

export default {
  name: 'initrole',
  async execute(message, args) {
    // Check admin permission
    if (!await isAdmin(message.member)) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor('Red')
          .setTitle('Unauthorized')
          .setDescription('You are not authorized to use this command.')],
        ephemeral: true
      });
    }

    // Delete all existing initrole messages
    if (args[0] === 'delete') {
      const { data: initRoles, error } = await supabase
        .from('init_roles')
        .select('*')
        .eq('guild_id', message.guild.id);

      if (initRoles) {
        for (const entry of initRoles) {
          try {
            const ch = await message.guild.channels.fetch(entry.channel_id);
            const msg = await ch.messages.fetch(entry.message_id);
            await msg.delete();
          } catch (err) {
            console.warn(`Couldn't delete init role message: ${err.message}`);
          }
        }

        await supabase.from('init_roles').delete().eq('guild_id', message.guild.id);

        return message.reply({
          embeds: [new EmbedBuilder()
            .setColor('Green')
            .setTitle('Init Roles Reset')
            .setDescription('All init role messages have been deleted.')],
        });
      }
      return;
    }

    const channel = message.mentions.channels.first();
    if (!channel) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor('Red')
          .setTitle('Invalid Usage')
          .setDescription('Please tag a channel to send the init role button to. Example: `$initrole #welcome`')],
      });
    }

    // Open modal-like interaction via DMs
    try {
      await message.author.send('Let’s set up the init role button.\n\nReply with the **button text** (e.g. `Join`):');
      const collected1 = await message.author.dmChannel.awaitMessages({ max: 1, time: 60000 });
      const buttonText = collected1.first().content;

      await message.author.send('Tag roles to **add** (e.g. `@Member @Verified`):');
      const collected2 = await message.author.dmChannel.awaitMessages({ max: 1, time: 60000 });
      const rolesToAdd = collected2.first().mentions.roles.map(r => r.id);

      await message.author.send('Tag roles to **remove** (optional):');
      const collected3 = await message.author.dmChannel.awaitMessages({ max: 1, time: 60000 });
      const rolesToRemove = collected3.first().mentions.roles.map(r => r.id);

      const button = new ButtonBuilder()
        .setCustomId(`initrole_${Date.now()}`)
        .setLabel(buttonText || 'Select')
        .setStyle(ButtonStyle.Primary);

      const row = new ActionRowBuilder().addComponents(button);

      const sent = await channel.send({
        content: 'Click the button below to receive your initial roles!',
        components: [row]
      });

      // Save to Supabase
      await supabase.from('init_roles').insert({
        guild_id: message.guild.id,
        channel_id: channel.id,
        message_id: sent.id,
        roles_to_add: rolesToAdd,
        roles_to_remove: rolesToRemove,
        button_label: buttonText
      });

      await message.reply({
        embeds: [new EmbedBuilder()
          .setColor('Green')
          .setTitle('Init Role Setup Complete')
          .setDescription(`Init role message sent to ${channel}`)],
      });
    } catch (err) {
      console.error('Initrole setup error:', err);
      message.reply('Something went wrong while setting up the init role button.');
    }
  }
};
