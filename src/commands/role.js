import { cmdErrorEmbed, cmdWarningEmbed, cmdResponseEmbed } from '../utils/embeds.js';
import { PermissionsBitField } from 'discord.js';

const permissionLevel = 'Mod';

const data = {
  name: 'role',
  description: 'Assign a role to a user. Requires Manage Roles permission.',
  usage: '$role @user @role',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command role.js executed with args:', args);
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Permission Denied',
            '❌ You need the **Manage Roles** permission to use this command.'
          ),
        ],
      },
    };
  }

  if (args.length < 2) {
    return {
      reply: {
        embeds: [
          cmdWarningEmbed(
            'Invalid Usage',
            '❗ Please mention both a user and a role.\n\n**Example:** `$role @user @role`'
          ),
        ],
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
        embeds: [
          cmdErrorEmbed(
            'Invalid User',
            '❌ Could not find the specified user.\n\nMake sure to mention them correctly: `$role @user @role`'
          ),
        ],
      },
    };
  }

  if (!role) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Role',
            '❌ Could not find the specified role.\n\nMake sure to mention the role like: `$role @user @role`'
          ),
        ],
      },
    };
  }

  if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Bot Missing Permission',
            '❌ I need the **Manage Roles** permission to assign roles.'
          ),
        ],
      },
    };
  }

  const botHighest = message.guild.members.me.roles.highest;
  if (role.position >= botHighest.position) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Role Too High',
            '❌ I cannot assign a role that is higher or equal to my highest role.\n\nPlease lower the role’s position in the role settings.'
          ),
        ],
      },
    };
  }

  const authorHighest = message.member.roles.highest;
  if (role.position >= authorHighest.position) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Insufficient Role Power',
            '❌ You cannot assign a role that is higher or equal to your highest role.'
          ),
        ],
      },
    };
  }

  try {
    if (member.roles.cache.has(role.id)) {
      return {
        reply: {
          embeds: [
            cmdWarningEmbed(
              'Role Already Assigned',
              `ℹ️ ${member.user.tag} already has the role **${role.name}**.`
            ),
          ],
        },
      };
    }

    await member.roles.add(role);

    return {
      reply: {
        embeds: [
          cmdResponseEmbed(
            'Role Assigned',
            `✅ Successfully added **${role.name}** to ${member.user.tag}.`
          ),
        ],
      },
      log: {
        action: 'assignRole',
        targetUserId: member.id,
        targetUserTag: member.user.tag,
        roleId: role.id,
        roleName: role.name,
        moderatorId: message.author.id,
        moderatorTag: message.author.tag,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    console.error('Error adding role:', error);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Unexpected Error',
            '❌ Something went wrong while assigning the role.\n\nCheck my permissions and the role hierarchy.'
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
