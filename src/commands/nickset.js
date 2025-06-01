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
  usage: '$nickset #channel msg(Your message) btn(Button Text) @memberRole @visitorRole',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command nickset.js executed with args:', args);
  
  const channel = message.mentions.channels.first();
  const rolesMentioned = Array.from(message.mentions.roles.values());
  const memberRole = rolesMentioned[0];
  const visitorRole = rolesMentioned[1];

  const msgMatch = message.content.match(/msg\((.*?)\)/);
  const btnMatch = message.content.match(/btn\((.*?)\)/);
  const msgText = msgMatch?.[1];
  const btnText = btnMatch?.[1];

  if (!channel || !msgText || !btnText || !memberRole || !visitorRole) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Syntax',
            '❌ Missing arguments.\n\n' +
            '**Usage:** `$nickset #channel msg(Welcome) btn(Click Me) @memberRole @visitorRole`'
          )
        ],
      },
    };
  }

  // Ensure guild_settings row exists
  const { data: existing, error: fetchError } = await supabase
    .from('guild_settings')
    .select('nick_message_id')
    .eq('guild_id', message.guild.id)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error('❌ Supabase fetch error:', fetchError.message);
    return {
      reply: {
        embeds: [cmdErrorEmbed('Database Error', '❌ Could not check existing nickset configuration.')],
      },
    };
  }

  // Try deleting the previous nickset message if it exists
  if (existing?.nick_message_id) {
    try {
      const oldMsg = await channel.messages.fetch(existing.nick_message_id);
      if (oldMsg) {
        await oldMsg.delete();
        console.log('🗑️ Deleted old nickset message:', existing.nick_message_id);
      }
    } catch (err) {
      console.warn('⚠️ Could not delete old nickset message (might not exist):', err.message);
    }
  }

  // Create new button
  const button = new ButtonBuilder()
    .setCustomId('nickset_button')
    .setLabel(btnText)
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  // Send new message
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

  // Insert or update guild_settings with new message and role IDs
  const { error: upsertError } = await supabase
    .from('guild_settings')
    .upsert(
      {
        guild_id: message.guild.id,
        nick_message_id: sent.id,
        member_role_id: memberRole.id,
        visitor_role_id: visitorRole.id,
      },
      { onConflict: 'guild_id' }
    );

  if (upsertError) {
    console.error('❌ Supabase upsert error (nick_message_id & roles):', upsertError);
    return {
      reply: {
        embeds: [cmdErrorEmbed('Database Error', '❌ Failed to save message ID and roles.')],
      },
    };
  }

  return {
    reply: {
      embeds: [
        cmdResponseEmbed(
          'Nickname Setup Sent',
          `✅ A button was sent to ${channel}.\nUsers can now click it to set their name and get roles.`,
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
