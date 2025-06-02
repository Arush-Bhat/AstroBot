import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Admin'; // Restrict command usage to Admins only

const data = {
  name: 'unban',
  description: 'Unban a user by their user ID. Admin-level command.',
  usage: '$unban userID Reason here',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command unban.js executed with args:', args);

  // Validate that at least one argument (user ID) is provided
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

  const userId = args[0]; // Extract user ID from the first argument
  const reason = args.slice(1).join(' ') || 'No reason provided'; // Combine remaining args as reason, or default message

  try {
    // Fetch all banned users in the guild
    const bannedUsers = await message.guild.bans.fetch();
    // Get ban info for the specified user ID
    const banInfo = bannedUsers.get(userId);

    // If the user is not found in the ban list, notify and exit
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

    // Unban the user with a reason including executor's tag
    await message.guild.members.unban(userId, `Unbanned by ${message.author.tag}: ${reason}`);

    // Remove the unbanned user from the 'banned_users' table in Supabase for this guild
    const { error } = await supabase
      .from('banned_users')
      .delete()
      .eq('guild_id', message.guild.id)
      .eq('banned_user_id', userId);

    if (error) {
      // Log any errors encountered while removing from Supabase
      console.error('Supabase delete error:', error);
      // Optional: Could notify about this error if desired
    }

    // Return a success response embed and log information for moderation logging
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
    // Catch and log any errors during unbanning
    console.error('Unban failed:', err);
    // Return an error embed informing about failure (likely permission or invalid ID)
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
