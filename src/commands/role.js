import { cmdErrorEmbed, cmdWarningEmbed, cmdResponseEmbed } from '../utils/embeds.js';
import { PermissionsBitField } from 'discord.js';

const permissionLevel = 'Mod';

const data = {
  name: 'role',
  description: 'Assign a role to a user. Requires Manage Roles permission.',
  usage: '$role @user @role',
};

async function execute(client, message, args, supabase) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return {
      reply: {
        embeds: [cmdErrorEmbed('❌ Unauthorized', 'You need the **Manage Roles** permission to use this command.')],
      },
    };
  }

  if (args.length < 2) {
    return {
      reply: {
        embeds: [cmdWarningEmbed('❌ Invalid Usage', 'Usage: `$role @user @role`')],
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
        embeds: [cmdErrorEmbed('❌ Invalid User', 'Please mention a valid user.')],
      },
    };
  }

  if (!role) {
    return {
      reply: {
        embeds: [cmdErrorEmbed('❌ Invalid Role', 'Please mention a valid role.')],
      },
    };
  }

  if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return {
      reply: {
        embeds: [cmdErrorEmbed('❌ Missing Permission', 'I need the **Manage Roles** permission to do that.')],
      },
    };
  }

  const botHighest = message.guild.members.me.roles.highest;
  if (role.position >= botHighest.position) {
    return {
      reply: {
        embeds: [cmdErrorEmbed('❌ Role Hierarchy Error', 'I cannot manage a role higher or equal to my highest role.')],
      },
    };
  }

  const authorHighest = message.member.roles.highest;
  if (role.position >= authorHighest.position) {
    return {
      reply: {
        embeds: [cmdErrorEmbed('❌ Role Hierarchy Error', 'You cannot assign a role higher or equal to your highest role.')],
      },
    };
  }

  try {
    if (member.roles.cache.has(role.id)) {
      return {
        reply: {
          embeds: [cmdWarningEmbed('ℹ️ Role Already Assigned', `${member.user.tag} already has the role **${role.name}**.`)],
        },
      };
    }

    await member.roles.add(role);

    return {
      reply: {
        embeds: [cmdResponseEmbed('✅ Role Added', `Added role **${role.name}** to ${member.user.tag}.`)],
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
        embeds: [cmdErrorEmbed('❌ Error', 'There was an error adding the role. Check my permissions and role hierarchy.')],
      },
    };
  }
}

export default {
  data,
  permissionLevel,
  execute,
};