// src/commands/ban.js

import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Admin';

const data = {
  name: 'ban',
  description: 'Ban a user from the server. Administrator-level command.',
  usage: '$ban @user reason(Spamming in chat)',
};

async function execute(client, message, args, supabase) {
  const guild = message.guild;
  const member = message.member;

  // Get the mentioned user to ban
  const target = message.mentions.members.first();
  if (!target) {
    return {
      reply: { embeds: [cmdErrorEmbed('Please mention a valid user to ban.')] },
    };
  }

  // Check if target is server owner
  if (target.id === guild.ownerId) {
    return {
      reply: { embeds: [cmdErrorEmbed('Cannot ban the server owner.')] },
    };
  }

  // Check role hierarchy: target must be lower than command user or author is owner
  if (
    target.roles.highest.position >= member.roles.highest.position &&
    message.author.id !== guild.ownerId
  ) {
    return {
      reply: { embeds: [cmdErrorEmbed('You cannot ban someone with equal or higher role.')] },
    };
  }

  // Extract reason: everything after the mention, fallback default
  const mentionIndex = message.content.indexOf('>');
  const reason = mentionIndex !== -1
    ? message.content.slice(mentionIndex + 1).trim() || 'No reason provided'
    : 'No reason provided';

  try {
    await target.ban({ reason: `Banned by ${message.author.tag}: ${reason}` });

    // Log to Supabase banned_users table
    const { error } = await supabase
      .from('banned_users')
      .upsert({
        guild_id: guild.id,
        user_id: target.id,
        reason,
        banned_by: message.author.id,
        banned_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Supabase logging error:', error);
      // Optionally notify about log failure but do not block ban success
    }

    // Send success reply
    return {
      reply: {
        embeds: [cmdResponseEmbed(`🔨 **${target.user.tag}** was banned.\n**Reason:** ${reason}`)],
      },
      log: {
        action: 'ban',
        targetUserId: target.id,
        targetTag: target.user.tag,
        executorUserId: message.author.id,
        executorTag: message.author.tag,
        guildId: guild.id,
        reason,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.error('Ban failed:', err);
    return {
      reply: { embeds: [cmdErrorEmbed('Failed to ban the user. Check bot permissions.')] },
    };
  }
};

export default {
  data,
  permissionLevel,
  execute,
};