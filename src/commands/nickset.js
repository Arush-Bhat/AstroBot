// src/commands/nickset.js

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from 'discord.js';
import { cmdResponseEmbed, cmdErrorEmbed } from '../utils/embeds.js';
import { logCommand } from '../utils/modlog.js';

const permissionLevel = 'Admin';

const data = {
  name: 'nickset',
  description: 'Send a message with a button that sets a user\'s nickname via DM confirmation.',
  usage: '$nickset #channel msg(Your message) btn(Button Text) @role @visrole',
};

async function execute(client, message, args, supabase) {
  const channel = message.mentions.channels.first();
  const rolesMentioned = Array.from(message.mentions.roles.values());
  const targetRole = rolesMentioned[0]; // The role to give
  const visRole = rolesMentioned[1];    // The role to remove (e.g., "Unverified")

  const msgMatch = message.content.match(/msg\((.*?)\)/);
  const btnMatch = message.content.match(/btn\((.*?)\)/);
  const msgText = msgMatch ? msgMatch[1] : null;
  const btnText = btnMatch ? btnMatch[1] : null;

  if (!channel || !msgText || !btnText || !targetRole || !visRole) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Syntax',
            '❌ Missing required arguments.\n\n' +
            '**Correct Usage:**\n' +
            '`$nickset #channel msg(Welcome message) btn(Click Me) @role @visrole`\n\n' +
            '- `#channel`: where the message should be sent\n' +
            '- `msg(...)`: text to display\n' +
            '- `btn(...)`: button label\n' +
            '- `@role`: role to assign after confirmation\n' +
            '- `@visrole`: role to remove (like "Unverified")'
          )
        ],
      },
    };
  }

  // Build button row
  const button = new ButtonBuilder()
    .setCustomId('nickset_button')
    .setLabel(btnText)
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  // Send interactive message
  let sent;
  try {
    sent = await channel.send({
      content: msgText,
      components: [row],
    });
  } catch (err) {
    console.error('Failed to send nickname prompt:', err);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Message Send Failed',
            '❌ I was unable to send the message in the specified channel.\n\n' +
            'Please ensure I have permission to send messages and use embeds in that channel.'
          )
        ],
      },
    };
  }

  // Set up collector for button clicks
  const collector = sent.createMessageComponentCollector({
    time: 1000 * 60 * 60 * 24 * 7, // 7 days
  });

  collector.on('collect', async interaction => {
    if (!interaction.isButton()) return;

    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (!member) return;

    try {
      await interaction.reply({
        content: '📩 Check your DMs to continue.',
        ephemeral: true,
      });

      const dm = await interaction.user.createDM();
      await dm.send('📛 Please enter your **real name**. This will be set as your nickname.');

      const filter = m => m.author.id === interaction.user.id;
      const collected = await dm.awaitMessages({ filter, max: 1, time: 60000 });
      const name = collected.first()?.content;

      if (!name) return await dm.send('❌ No name received. Please try again later.');

      await dm.send(`✅ Is **"${name}"** correct? Reply with \`y\` to confirm.`);

      const confirm = await dm.awaitMessages({ filter, max: 1, time: 30000 });
      const confirmation = confirm.first()?.content.toLowerCase();

      if (confirmation !== 'y') {
        return await dm.send('❌ Confirmation failed. No changes were made.');
      }

      await member.setNickname(name, 'Nickname set via $nickset');
      await member.roles.add(targetRole);
      await member.roles.remove(visRole);

      await dm.send('✅ Nickname set successfully and roles updated!');
    } catch (err) {
      console.error('Nickname setup error:', err);
      try {
        await interaction.user.send(
          '❌ An error occurred while setting your nickname. Please ensure:\n' +
          '- Your DMs are open\n' +
          '- I have permission to change nicknames and manage roles\n\n' +
          'Then try again.'
        );
      } catch (_) {}
    }
  });

  return {
    reply: {
      embeds: [
        cmdResponseEmbed(
          'Nickname Setup Prompt Sent',
          `✅ A button message was successfully sent in ${channel}.\nUsers can now click it to begin nickname setup.`,
          'Green'
        ),
      ],
    },
    reason: `Setup nickname prompt in ${channel}`,
  };
}

export default {
  data,
  permissionLevel,
  execute,
};
