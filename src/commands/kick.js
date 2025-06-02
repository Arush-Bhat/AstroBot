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

  // Fetch mod and admin roles from Supabase
  const { data: settings, error } = await supabase
    .from('guild_settings')
    .select('mod_role_id, admin_role_id')
    .eq('guild_id', guild.id)
    .single();

  if (error) {
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

  // Check if user is mod or admin
  if (
    !member.roles.cache.has(modRoleId) &&
    !member.roles.cache.has(adminRoleId) &&
    !member.permissions.has('Administrator')
  ) {
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

  // Must have at least 2 args: @user and "reason"
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

  // Get target user from mention
  const target = message.mentions.members.first();
  if (!target) {
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

  // Extract reason — everything after the mention as a quoted string
  // Join args after mention and match quoted text
  const argsStr = message.content.split(' ').slice(2).join(' ').trim();
  const reasonMatch = argsStr.match(/^"(.+)"$/);

  if (!reasonMatch) {
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

  // Check if target is server owner
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

  // Check that target is lower than command user in role hierarchy
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
    // Send DM before kicking
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
      console.warn(`Could not DM ${target.user.tag} before kicking.`);
    });

    await target.kick(`Kicked by ${message.author.tag}: ${reason_given}`);

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
