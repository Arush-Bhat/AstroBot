import { cmdErrorEmbed, cmdWarningEmbed, cmdResponseEmbed } from '../utils/embedHelpers.js';
import { PermissionsBitField } from 'discord.js';

const permissionLevel = 'Mod';

const data = {
  name: 'role',
  description: 'Assign a role to a user',
  usage: '$role @user @role',
};

async function execute(message, args) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return message.channel.send({ embeds: [cmdErrorEmbed('❌ Unauthorized', 'You need the Manage Roles permission to use this command.')] });
  }

  if (args.length < 2) {
    return message.channel.send({ embeds: [cmdWarningEmbed('❌ Invalid Usage', 'Usage: $role @user @role')] });
  }

  const userMention = args[0];
  const roleMention = args[1];

  const userId = userMention.replace(/[<@!>]/g, '');
  const roleId = roleMention.replace(/[<@&>]/g, '');

  const member = message.guild.members.cache.get(userId);
  const role = message.guild.roles.cache.get(roleId);

  if (!member) {
    return message.channel.send({ embeds: [cmdErrorEmbed('❌ Invalid User', 'Please mention a valid user.')] });
  }

  if (!role) {
    return message.channel.send({ embeds: [cmdErrorEmbed('❌ Invalid Role', 'Please mention a valid role.')] });
  }

  if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return message.channel.send({ embeds: [cmdErrorEmbed('❌ Missing Permission', 'I need Manage Roles permission to do that.')] });
  }

  // Check role hierarchy (bot)
  const botHighestRole = message.guild.members.me.roles.highest;
  if (role.position >= botHighestRole.position) {
    return message.channel.send({ embeds: [cmdErrorEmbed('❌ Role Hierarchy Error', 'I cannot manage a role higher or equal to my highest role.')] });
  }

  // Check role hierarchy (author)
  const authorHighestRole = message.member.roles.highest;
  if (role.position >= authorHighestRole.position) {
    return message.channel.send({ embeds: [cmdErrorEmbed('❌ Role Hierarchy Error', 'You cannot manage a role higher or equal to your highest role.')] });
  }

  try {
    if (member.roles.cache.has(role.id)) {
      return message.channel.send({ embeds: [cmdWarningEmbed('ℹ️ Role Already Assigned', `${member.user.tag} already has the role ${role.name}.`)] });
    }

    await member.roles.add(role);
    await message.channel.send({ embeds: [cmdResponseEmbed('✅ Role Added', `Added role ${role.name} to ${member.user.tag}.`)] });

    // Return log info
    return {
      action: 'assignRole',
      targetUserId: member.id,
      targetUserTag: member.user.tag,
      roleId: role.id,
      roleName: role.name,
      moderatorId: message.author.id,
      moderatorTag: message.author.tag,
    };
  } catch (error) {
    console.error('Error adding role:', error);
    await message.channel.send({ embeds: [cmdErrorEmbed('❌ Error', 'There was an error adding the role. Check my permissions and role hierarchy.')] });
  }
}

export default {
  permissionLevel,
  data,
  execute,
};