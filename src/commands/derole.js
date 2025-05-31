import { PermissionsBitField } from 'discord.js';
import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embedHelpers.js';

const permissionLevel = 'Mod';

const data = {
  name: 'derole',
  description: 'Remove a role from a user',
  usage: '$derole @user @role',
};

async function execute(message, args) {
  // Permission check for Manage Roles
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return {
      reply: {
        embeds: [cmdErrorEmbed('Unauthorized', 'You need the Manage Roles permission to use this command.')],
      },
    };
  }

  if (args.length < 2) {
    return {
      reply: {
        embeds: [cmdErrorEmbed('Invalid Usage', 'Usage: $derole @user @role')],
      },
    };
  }

  const userMention = args[0];
  const roleMention = args[1];

  const userId = userMention.replace(/[<@!>]/g, '');
  const roleId = roleMention.replace(/[<@&>]/g, '');

  const member = message.guild.members.cache.get(userId);
  const role = message.guild.roles.cache.get(roleId);

  if (!member) {
    return {
      reply: {
        embeds: [cmdErrorEmbed('Invalid User', 'Please mention a valid user.')],
      },
    };
  }

  if (!role) {
    return {
      reply: {
        embeds: [cmdErrorEmbed('Invalid Role', 'Please mention a valid role.')],
      },
    };
  }

  if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return {
      reply: {
        embeds: [cmdErrorEmbed('Missing Permission', 'I need Manage Roles permission to do that.')],
      },
    };
  }

  // Check role hierarchy (bot)
  const botHighestRole = message.guild.members.me.roles.highest;
  if (role.position >= botHighestRole.position) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Role Hierarchy Error',
            'I cannot manage a role higher or equal to my highest role.'
          ),
        ],
      },
    };
  }

  // Check role hierarchy (author)
  const authorHighestRole = message.member.roles.highest;
  if (role.position >= authorHighestRole.position) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Role Hierarchy Error',
            'You cannot manage a role higher or equal to your highest role.'
          ),
        ],
      },
    };
  }

  try {
    if (!member.roles.cache.has(role.id)) {
      return {
        reply: {
          embeds: [
            cmdResponseEmbed(
              'Role Not Assigned',
              `${member.user.tag} does not have the role ${role.name}.`,
              'Yellow'
            ),
          ],
        },
      };
    }

    await member.roles.remove(role);

    return {
      reply: {
        embeds: [
          cmdResponseEmbed(
            'Role Removed',
            `Removed role ${role.name} from ${member.user.tag}.`,
            'Green'
          ),
        ],
      },
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
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Error',
            'There was an error removing the role. Check my permissions and role hierarchy.'
          ),
        ],
      },
    };
  }
};

export default {
  permissionLevel,
  data,
  execute,
};