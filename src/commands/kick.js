import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Mod';

const data = {
  name: 'kick',
  description: 'Kick a user from the server. Moderator-level command.',
  usage: '$kick @user',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command modch.js executed with args:', args);
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

  if (args.length < 1) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Usage',
            '❌ Please mention a user to kick.\n\nExample usage: `$kick @user`'
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
            '❌ Please mention a valid user to kick.\n\nExample usage: `$kick @user`'
          )
        ],
      },
    };
  }

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
    await target.kick(`Kicked by ${message.author.tag}`);

    // Return success reply and data for logCommand
    return {
      reply: {
        embeds: [
          cmdResponseEmbed(
            'User Kicked',
            `👢 Kicked ${target.user.tag} successfully.`
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
        reason: `Kicked by ${message.author.tag}`,
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
