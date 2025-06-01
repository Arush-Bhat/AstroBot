import { PermissionsBitField } from 'discord.js';
import { cmdErrorEmbed, cmdWarningEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Mod';

const data = {
  name: 'derole',
  description: 'Remove a role from a user',
  usage: '$derole @user @role',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command derole.js executed with args:', args);
  // Permission check for Manage Roles
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            '❌ Permission Denied | Manage Roles Required',
            'You need the **Manage Roles** permission to use this command.'
          )
        ],
      },
    };
  }

  if (args.length < 2) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            '❌ Invalid Usage | Missing Arguments',
            'Usage: `$derole @user @role`\n\n' +
            'Example: `$derole @JohnDoe @Muted`'
          )
        ],
      },
    };
  }

  const userMention = args[0];
  const roleMention = args[1];

  const userId = userMention.replace(/[<@!>]/g, '');
  const roleId = roleMention.replace(/[<@&>]/g, '');

  let member;
  try {
    member = await message.guild.members.fetch(userId);
  } catch {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            '❌ Invalid User | User Not Found',
            'Please mention a valid user to remove the role from.\n\n' +
            'Usage: `$derole @user @role`'
          )
        ],
      },
    };
  }

  const role = message.guild.roles.cache.get(roleId);
  if (!role) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            '❌ Invalid Role | Role Not Found',
            'Please mention a valid role to remove.\n\n' +
            'Usage: `$derole @user @role`'
          )
        ],
      },
    };
  }

  if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            '❌ Missing Permission | Bot Needs Manage Roles',
            'I need the **Manage Roles** permission to remove roles from members.'
          )
        ],
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
            '❌ Hierarchy Error | Bot Role Too Low',
            'I cannot manage a role that is higher or equal to my highest role.'
          )
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
            '❌ Hierarchy Error | Your Role Too Low',
            'You cannot remove a role that is higher or equal to your highest role.'
          )
        ],
      },
    };
  }

  try {
    if (!member.roles.cache.has(role.id)) {
      return {
        reply: {
          embeds: [
            cmdWarningEmbed(
              '⚠️ Role Not Found | Member Missing Role',
              `${member.user.tag} does not have the role **${role.name}**.`
            )
          ],
        },
      };
    }

    await member.roles.remove(role);

    return {
      reply: {
        embeds: [
          cmdResponseEmbed(
            '✅ Role Removed',
            `Removed role **${role.name}** from ${member.user.tag}.`
          )
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
            '❌ Action Failed | Unable to Remove Role',
            'There was an error removing the role. Please check my permissions and the role hierarchy.'
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
