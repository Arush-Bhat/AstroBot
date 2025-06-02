import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Admin';

const data = {
  name: 'unban',
  description: 'Unban a user by their user ID. Admin-level command.',
  usage: '$unban userID Reason here',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command unban.js executed with args:', args);

  if (args.length < 1) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Usage',
            '❌ You must provide a user ID to unban.\n\nExample: `$unban 123456789012345678 Apologized for behavior`'
          ),
        ],
      },
    };
  }

  const userId = args[0];
  const reason = args.slice(1).join(' ') || 'No reason provided';

  try {
    const bannedUsers = await message.guild.bans.fetch();
    const banInfo = bannedUsers.get(userId);

    if (!banInfo) {
      return {
        reply: {
          embeds: [
            cmdErrorEmbed(
              'Not Found',
              `❌ No banned user found with ID \`${userId}\`.`
            ),
          ],
        },
      };
    }

    await message.guild.members.unban(userId, `Unbanned by ${message.author.tag}: ${reason}`);

    // Remove from banned_users table in Supabase
    const { error } = await supabase
      .from('banned_users')
      .delete()
      .eq('guild_id', message.guild.id)
      .eq('banned_user_id', userId);

    if (error) {
      console.error('Supabase delete error:', error);
      // You could optionally notify about this error here if needed
    }

    return {
      reply: {
        embeds: [
          cmdResponseEmbed(
            'User Unbanned',
            `✅ **${banInfo.user.tag}** was unbanned.\n**Reason:** ${reason}`
          ),
        ],
      },
      log: {
        action: 'unban',
        targetUserId: userId,
        targetTag: banInfo.user.tag,
        executorUserId: message.author.id,
        executorTag: message.author.tag,
        guildId: message.guild.id,
        reason: `Unbanned for reason: ${reason}`,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err) {
    console.error('Unban failed:', err);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Action Failed',
            '❌ Failed to unban the user. Make sure the ID is correct and I have permission.'
          ),
        ],
      },
    };
  }
}

export default {
  data,
  permissionLevel,
  execute,
};
