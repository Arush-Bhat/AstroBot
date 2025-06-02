import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Mod';

const data = {
  name: 'kick',
  description: 'Kick a user from the server. Moderator-level command.',
  usage: '$kick @user "Reason inside quotes"',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command kick.js executed with args:', args);
  const guild = message.guild;
  const member = message.member;

  // Fetch mod and admin roles from Supabase database for the current guild
  const { data: settings, error } = await supabase
    .from('guild_settings')
    .select('mod_role_id, admin_role_id')
    .eq('guild_id', guild.id)
    .single();

  if (error) {
    // If database query fails, send an error embed
    console.error(error);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Database Error',
            '❌ Database error fetching roles.\n\nPlease try again later or contact an admin.'
          )
        ],
      },
    };
  }

  const modRoleId = settings?.mod_role_id;
  const adminRoleId = settings?.admin_role_id;

  // If mod role is not set in the database, instruct user to set it
  if (!modRoleId) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Configuration Error',
            '❌ Mod role is not set for this server.\n\n' +
            'Please set a mod role first using the command: `$setmod @role`'
          )
        ],
      },
    };
  }

  // Check if the command user has mod role, admin role, or Administrator permission
  if (
    !member.roles.cache.has(modRoleId) &&
    !member.roles.cache.has(adminRoleId) &&
    !member.permissions.has('Administrator')
  ) {
    // If not authorized, send permission denied embed
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Permission Denied',
            '❌ You do not have permission to kick users.\n\n' +
            'Required role: Mod or Admin, or Administrator permission.'
          )
        ],
      },
    };
  }

  // Ensure at least two arguments are provided: user mention and reason
  if (args.length < 2) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Usage',
            '❌ You must mention a user and provide a reason in quotes.\n\n' +
            'Example usage: `$kick @user \"Spamming in channels\"`'
          )
        ],
      },
    };
  }

  // Get the mentioned target user/member to kick
  const target = message.mentions.members.first();
  if (!target) {
    // If no valid user mention, send invalid user error
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid User',
            '❌ Please mention a valid user to kick.\n\nExample usage: `$kick @user \"Reason here\"`'
          )
        ],
      },
    };
  }

  // Extract the reason string inside quotes after the mention
  // Slice out the mention part and join the rest as a string
  const argsStr = message.content.split(' ').slice(2).join(' ').trim();
  // Match the entire string enclosed in quotes
  const reasonMatch = argsStr.match(/^"(.+)"$/);

  if (!reasonMatch) {
    // If no valid quoted reason found, send missing reason error
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Missing Reason',
            '❌ You must provide a reason inside quotes.\n\nExample usage: `$kick @user \"Spamming in channels\"`'
          )
        ],
      },
    };
  }

  const reason_given = reasonMatch[1];

  // Prevent kicking the server owner
  if (target.id === guild.ownerId) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Action',
            '❌ Cannot kick the server owner.\n\nPlease choose another user.'
          )
        ],
      },
    };
  }

  // Ensure the target's highest role is lower than the command user's highest role
  // Owner is exempt from this check
  if (target.roles.highest.position >= member.roles.highest.position && message.author.id !== guild.ownerId) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Role Hierarchy',
            '❌ You cannot kick someone with an equal or higher role.\n\n' +
            'Ensure your highest role is above the target user\'s highest role.'
          )
        ],
      },
    };
  }

  try {
    // Attempt to send DM to the target user before kicking
    const dmEmbed = {
      title: 'You Have Been Kicked',
      description:
        `You were kicked from **${guild.name}** by **${message.author.tag}**.\n\n` +
        `**Reason:** ${reason_given}\n**Message ID:** ${message.id}\n\n` +
        `You may rejoin the server, but note that this is considered a warning.\n\n` +
        `If you believe this was unfair:\n` +
        `📄 Fill this form: [Appeal Form](https://docs.google.com/forms/d/e/1FAIpQLSdDfwtITGNLKbCoHBPceEVEDwK6TtK6I3ANlm7sly9UO1ddoQ/viewform?usp=dialog)\n\n` +
        `Include the server name, your user ID (**${target.id}**), the message ID (**${message.id}**), your real name, and any relevant proof.\n\n` +
        `⚠️ Directly contacting administrators is allowed, but trolling or spamming will result in losing your right to appeal.`,
      color: 0xffa500
    };

    await target.send({ embeds: [dmEmbed] }).catch(() => {
      // If DM fails (e.g. user closed DMs), log a warning but continue
      console.warn(`Could not DM ${target.user.tag} before kicking.`);
    });

    // Kick the target user from the guild with reason in audit log
    await target.kick(`Kicked by ${message.author.tag}: ${reason_given}`);

    // Return success response embed and logging info
    return {
      reply: {
        embeds: [
          cmdResponseEmbed(
            'User Kicked',
            `👢 Kicked ${target.user.tag} successfully.\n**Reason:** ${reason_given}`
          )
        ],
      },
      log: {
        action: 'kick',
        targetUserId: target.id,
        targetTag: target.user.tag,
        executorUserId: message.author.id,
        executorTag: message.author.tag,
        guildId: guild.id,
        reason: `${target.user.tag} kicked by ${message.author.tag} for reason: \"${reason_given}\"`,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (err) {
    // Catch any errors during kick and send failure embed
    console.error(err);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Error',
            '❌ Failed to kick the user. Please ensure I have the necessary permissions.'
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
