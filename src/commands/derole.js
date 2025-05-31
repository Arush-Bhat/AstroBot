import { PermissionsBitField } from 'discord.js';
import { cmdErrorEmbed, cmdWarningEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Mod';

const data = {
  name: 'derole',
  description: 'Remove a role from a user',
  usage: '$derole @user @role',
};

async function execute(client, message, args, supabase) {
  // Permission check for Manage Roles
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return cmdErrorEmbed(message, 'You need the Manage Roles permission to use this command.');
  }

  if (args.length < 2) {
    return cmdErrorEmbed(message, 'Usage: $derole @user @role');
  }

  const userMention = args[0];
  const roleMention = args[1];

  const userId = userMention.replace(/[<@!>]/g, '');
  const roleId = roleMention.replace(/[<@&>]/g, '');

  let member;
  try {
    member = await message.guild.members.fetch(userId);
  } catch {
    return cmdErrorEmbed(message, 'Please mention a valid user.');
  }

  const role = message.guild.roles.cache.get(roleId);
  if (!role) {
    return cmdErrorEmbed(message, 'Please mention a valid role.');
  }

  if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return cmdErrorEmbed(message, 'I need Manage Roles permission to do that.');
  }

  // Check role hierarchy (bot)
  const botHighestRole = message.guild.members.me.roles.highest;
  if (role.position >= botHighestRole.position) {
    return cmdErrorEmbed(
      message,
      'I cannot manage a role higher or equal to my highest role.'
    );
  }

  // Check role hierarchy (author)
  const authorHighestRole = message.member.roles.highest;
  if (role.position >= authorHighestRole.position) {
    return cmdErrorEmbed(
      message,
      'You cannot manage a role higher or equal to your highest role.'
    );
  }

  try {
    if (!member.roles.cache.has(role.id)) {
      return cmdWarningEmbed(
        message,
        `${member.user.tag} does not have the role ${role.name}.`
      );
    }

    await member.roles.remove(role);

    await cmdResponseEmbed(
      message,
      `Removed role ${role.name} from ${member.user.tag}.`
    );

    // Optionally log here if you want, e.g. return log info:
    return {
      log: {
        action: 'derole',
        targetUserId: member.id,
        targetTag: member.user.tag,
        executorUserId: message.author.id,
        executorTag: message.author.tag,
        guildId: message.guild.id,
        roleId: role.id,
        roleName: role.name,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Error removing role:', error);
    return cmdErrorEmbed(
      message,
      'There was an error removing the role. Check my permissions and role hierarchy.'
    );
  }
};

export default {
  data,
  permissionLevel,
  execute,
};