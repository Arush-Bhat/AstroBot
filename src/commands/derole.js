import { EmbedBuilder, PermissionsBitField } from 'discord.js';

export const data = {
  name: 'derole',
  description: 'Remove a role from a user',
  usage: '$derole @user @role',
};

export async function execute(message, args) {
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Unauthorized')
        .setDescription('You need the Manage Roles permission to use this command.')
        .setColor('Red')]
    });
  }

  if (args.length < 2) {
    return message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Invalid Usage')
        .setDescription('Usage: $derole @user @role')
        .setColor('Yellow')]
    });
  }

  const userMention = args[0];
  const roleMention = args[1];

  const userId = userMention.replace(/[<@!>]/g, '');
  const roleId = roleMention.replace(/[<@&>]/g, '');

  const member = message.guild.members.cache.get(userId);
  const role = message.guild.roles.cache.get(roleId);

  if (!member) {
    return message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Invalid User')
        .setDescription('Please mention a valid user.')
        .setColor('Red')]
    });
  }

  if (!role) {
    return message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Invalid Role')
        .setDescription('Please mention a valid role.')
        .setColor('Red')]
    });
  }

  if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Missing Permission')
        .setDescription('I need Manage Roles permission to do that.')
        .setColor('Red')]
    });
  }

  // Check role hierarchy (bot)
  const botHighestRole = message.guild.members.me.roles.highest;
  if (role.position >= botHighestRole.position) {
    return message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Role Hierarchy Error')
        .setDescription('I cannot manage a role higher or equal to my highest role.')
        .setColor('Red')]
    });
  }

  // Check role hierarchy (author)
  const authorHighestRole = message.member.roles.highest;
  if (role.position >= authorHighestRole.position) {
    return message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Role Hierarchy Error')
        .setDescription('You cannot manage a role higher or equal to your highest role.')
        .setColor('Red')]
    });
  }

  try {
    if (!member.roles.cache.has(role.id)) {
      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('ℹ️ Role Not Assigned')
          .setDescription(`${member.user.tag} does not have the role ${role.name}.`)
          .setColor('Yellow')]
      });
    }

    await member.roles.remove(role);
    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('✅ Role Removed')
        .setDescription(`Removed role ${role.name} from ${member.user.tag}.`)
        .setColor('Green')]
    });
  } catch (error) {
    console.error('Error removing role:', error);
    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('There was an error removing the role. Check my permissions and role hierarchy.')
        .setColor('Red')]
    });
  }
}
