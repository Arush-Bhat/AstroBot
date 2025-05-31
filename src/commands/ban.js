// src/commands/ban.js

import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

export const permissionLevel = 'Admin';

export default {
  name: 'ban',
  description: 'Ban a user from the server. Administrator-level command.',
  usage: '$ban @user reason(Spamming in chat)',

  async execute(client, message, args, supabase) {
    const guild = message.guild;
    const member = message.member;

    const target = message.mentions.members.first();
    const reasonMatch = message.content.match(/reason\(([^)]+)\)/i);
    const reason = reasonMatch ? reasonMatch[1].trim() : 'No reason provided';

    if (!target) {
      return message.reply({ embeds: [cmdErrorEmbed('Please mention a valid user to ban.')] });
    }

    if (target.id === guild.ownerId) {
      return message.reply({ embeds: [cmdErrorEmbed('Cannot ban the server owner.')] });
    }

    if (
      target.roles.highest.position >= member.roles.highest.position &&
      message.author.id !== guild.ownerId
    ) {
      return message.reply({ embeds: [cmdErrorEmbed('You cannot ban someone with equal or higher role.')] });
    }

    try {
      await target.ban({ reason: `Banned by ${message.author.tag}: ${reason}` });

      // Log to Supabase
      const { error } = await supabase
        .from('banned_users')
        .upsert({
          guild_id: guild.id,
          user_id: target.id,
          reason,
          banned_by: message.author.id,
        });

      if (error) {
        console.error('Supabase logging error:', error);
      }

      // Feedback
      await message.reply({
        embeds: [cmdResponseEmbed(`🔨 **${target.user.tag}** was banned.\n**Reason:** ${reason}`)],
      });

      // Return info for centralized log
      return {
        targetUserId: target.id,
        reason,
      };
    } catch (err) {
      console.error('Ban failed:', err);
      return message.reply({ embeds: [cmdErrorEmbed('Failed to ban the user. Check bot permissions.')] });
    }
  },
};
