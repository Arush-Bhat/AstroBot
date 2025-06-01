// src/commands/nickset.js

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { cmdResponseEmbed, cmdErrorEmbed } from '../utils/embeds.js';
import { logCommand } from '../utils/modlog.js';

const permissionLevel = 'Admin';

const data = {
  name: 'nickset',
  description: 'Send a button message to let users set their nickname via DM.',
  usage: '$nickset #channel msg(Your message) btn(Button Text) @role @visrole',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command nickset.js executed with args:', args);
  const channel = message.mentions.channels.first();
  const rolesMentioned = Array.from(message.mentions.roles.values());
  const targetRole = rolesMentioned[0];
  const visRole = rolesMentioned[1];

  const msgMatch = message.content.match(/msg\((.*?)\)/);
  const btnMatch = message.content.match(/btn\((.*?)\)/);
  const msgText = msgMatch?.[1];
  const btnText = btnMatch?.[1];

  if (!channel || !msgText || !btnText || !targetRole || !visRole) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Syntax',
            '❌ Missing arguments.\n\n' +
            '**Usage:** `$nickset #channel msg(Welcome) btn(Click Me) @role @visrole`'
          )
        ],
      },
    };
  }

  // Send the button message
  const button = new ButtonBuilder()
    .setCustomId('nickset_button')
    .setLabel(btnText)
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  let sent;
  try {
    sent = await channel.send({
      content: msgText,
      components: [row],
    });
  } catch (err) {
    console.error('❌ Failed to send nickset button:', err);
    return {
      reply: {
        embeds: [cmdErrorEmbed('Send Failed', '❌ I couldn’t send the message in that channel.')],
      },
    };
  }

  // Update guild_settings with the nick_message_id
  const { error: updateError } = await supabase
    .from('guild_settings')
    .update({ nick_message_id: sent.id })
    .eq('guild_id', message.guild.id);

  if (updateError) {
    console.error('❌ Supabase update error (nick_message_id):', updateError);
    return {
      reply: {
        embeds: [cmdErrorEmbed('Database Error', '❌ Failed to save the nickset button message ID.')],
      },
    };
  }

  return {
    reply: {
      embeds: [
        cmdResponseEmbed(
          'Nickname Setup Prompt Sent',
          `✅ A button was sent to ${channel}.\nUsers can now click it to start setup.`,
          'Green'
        )
      ],
    },
    reason: `Sent nickset button to ${channel}`,
  };
}

export default {
  data,
  permissionLevel,
  execute,
};
