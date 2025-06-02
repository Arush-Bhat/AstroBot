import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Admin';

const data = {
  name: 'ban',
  description: 'Ban a user from the server. Administrator-level command.',
  usage: '$ban @user reason(Spamming in chat)',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command ban.js executed with args:', args);
  const guild = message.guild;
  const member = message.member;

  // Get the mentioned user to ban
  const target = message.mentions.members.first();
  if (!target) {
    // No valid user mentioned, return error embed
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Usage',
            '❌ Please mention a valid user to ban.\n\n' +
            'Usage example: `$ban @user Spamming in chat`'
          )
        ],
      },
    };
  }

  // Prevent banning the server owner
  if (target.id === guild.ownerId) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Action',
            '❌ Cannot ban the server owner.\n\n' +
            'Please choose another user.'
          )
        ],
      },
    };
  }

  // Check role hierarchy: command issuer must have higher role than target, unless owner
  if (
    target.roles.highest.position >= member.roles.highest.position &&
    message.author.id !== guild.ownerId
  ) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Permission Denied',
            '❌ You cannot ban someone with equal or higher role.\n\n' +
            'Ensure your role is higher than the user you want to ban.'
          )
        ],
      },
    };
  }

  // Extract reason for ban: everything after the mention in the message content
  const mentionIndex = message.content.indexOf('>');
  const reason =
    mentionIndex !== -1
      ? message.content.slice(mentionIndex + 1).trim() || 'No reason provided'
      : 'No reason provided';

  try {
    // Prepare DM embed to notify the user before banning
    const dmEmbed = {
      title: 'You Have Been Banned',
      description:
        `You were banned from **${guild.name}** by **${message.author.tag}**.\n\n` +
        `**Reason:** ${reason}\n**Message ID:** ${message.id}\n\n` +
        `If you believe this was unfair, you may:\n` +
        `📄 Fill this form: [Appeal Form](https://docs.google.com/forms/d/e/1FAIpQLSdDfwtITGNLKbCoHBPceEVEDwK6TtK6I3ANlm7sly9UO1ddoQ/viewform?usp=dialog)\n\n` +
        `Provide the server name, your user ID (**${target.id}**), the message ID (**${message.id}**), your real name, and any relevant proof.\n\n` +
        `⚠️ Directly contacting administrators is allowed, but trolling or spamming will result in losing your right to appeal.`,
      color: 0xff0000
    };

    // Attempt to send DM to target user before banning; catch if unable
    await target.send({ embeds: [dmEmbed] }).catch(() => {
      console.warn(`Could not DM ${target.user.tag} before banning.`);
    });

    // Ban the target member with reason including executor's tag
    await target.ban({ reason: `Banned by ${message.author.tag}: ${reason}` });

    // Log ban details into Supabase 'banned_users' table with upsert (insert or update)
    const { error } = await supabase
      .from('banned_users')
      .upsert({
        guild_id: guild.id,
        banned_user_id: target.id,    // Use banned_user_id (not user_id)
        reason,
        banned_by: message.author.id,
        banned_at: new Date().toISOString(),
      });

    // Log any database error, optionally could notify admins
    if (error) {
      console.error('Supabase logging error:', error);
      // Optional: Could notify in a warning embed here if you want
    }

    // Return success embed and log info for further processing if needed
    return {
      reply: {
        embeds: [
          cmdResponseEmbed(
            'User Banned',
            `🔨 **${target.user.tag}** was banned.\n**Reason:** ${reason}`
          )
        ],
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
    // Catch any errors during the ban process, such as missing permissions
    console.error('Ban failed:', err);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Action Failed',
            '❌ Failed to ban the user. Please check that I have the necessary permissions.'
          )
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
