import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Mod';

const data = {
  name: 'kick',
  description: 'Kick a user from the server. Moderator-level command.',
  usage: '$kick @user',
};

async function execute(client, message, args, supabase) {
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
      reply: { embeds: [cmdErrorEmbed('Database Error', '❌ Database error fetching roles.')] },
    };
  }

  const modRoleId = settings?.mod_role_id;
  const adminRoleId = settings?.admin_role_id;

  if (!modRoleId) {
    return {
      reply: { embeds: [cmdErrorEmbed('Configuration Error', '❌ Mod role not set. Use `$setmod @role` first.')] },
    };
  }

  // Check if user is mod or admin
  if (
    !member.roles.cache.has(modRoleId) &&
    !member.roles.cache.has(adminRoleId) &&
    !member.permissions.has('Administrator')
  ) {
    return {
      reply: { embeds: [cmdErrorEmbed('Permission Denied', '❌ You do not have permission to kick users.')] },
    };
  }

  if (args.length < 1) {
    return {
      reply: { embeds: [cmdErrorEmbed('Invalid Usage', '❌ Please mention a user to kick.')] },
    };
  }

  // Get target user from mention
  const target = message.mentions.members.first();
  if (!target) {
    return {
      reply: { embeds: [cmdErrorEmbed('Invalid User', '❌ Please mention a valid user.')] },
    };
  }

  // Check if target is server owner
  if (target.id === guild.ownerId) {
    return {
      reply: { embeds: [cmdErrorEmbed('Invalid Action', '❌ Cannot kick the server owner.')] },
    };
  }

  // Check that target is lower than command user in role hierarchy
  if (target.roles.highest.position >= member.roles.highest.position && message.author.id !== guild.ownerId) {
    return {
      reply: { embeds: [cmdErrorEmbed('Role Hierarchy', '❌ You cannot kick someone with equal or higher role.')] },
    };
  }

  try {
    await target.kick(`Kicked by ${message.author.tag}`);

    // Return success reply and data for logCommand
    return {
      reply: {
        embeds: [cmdResponseEmbed('User Kicked', `👢 Kicked ${target.user.tag} successfully.`)],
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
      reply: { embeds: [cmdErrorEmbed('Error', '❌ Failed to kick the user. Check bot permissions.')] },
    };
  }
}

export default {
  data,
  permissionLevel,
  execute,
};