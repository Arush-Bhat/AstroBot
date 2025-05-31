import supabase from './src/supabaseClient.js';
import { EmbedBuilder } from 'discord.js';
import { client } from '../index.js';

// Helper: check if user has a role or higher (roles ordered by position)
function hasRoleOrHigher(member, roleId) {
  if (!roleId) return false;
  const memberRoles = member.roles.cache;
  const targetRole = member.guild.roles.cache.get(roleId);
  if (!targetRole) return false;

  // User must have at least one role with equal or higher position than targetRole
  return memberRoles.some(r => r.position >= targetRole.position);
}

client.on('messageCreate', async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith('$')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  // Load command from your commands collection
  const command = client.commands.get(commandName);
  if (!command) return;

  // Fetch roles from Supabase
  const { data: guildSettings, error } = await supabase
    .from('guild_settings')
    .select('mod_role_id, admin_role_id')
    .eq('guild_id', message.guild.id)
    .single();

  if (error) {
    console.error('Supabase error:', error);
    return await message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Database Error')
        .setDescription('Could not fetch guild settings.')
        .setColor('Red')]
    });
  }

  // If mod/admin roles not set and command is not setmod/setadmin
  if (
    (!guildSettings?.mod_role_id || !guildSettings?.admin_role_id) &&
    !['setmod', 'setadmin'].includes(commandName)
  ) {
    return await message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('⚠️ Roles Not Set')
        .setDescription('Please set the mod and admin roles first using `$setmod @role` and `$setadmin @role` commands.')
        .setColor('Yellow')]
    });
  }

  // Define which commands require mod/admin roles (expand as needed)
  const adminCommands = ['setadmin', 'ban', 'kick', 'mute', 'modlog', 'nickset'];
  const modCommands = ['setmod', 'modch', 'mute', 'kick', 'role', 'derole'];

  // Check permissions for admin commands
  if (adminCommands.includes(commandName)) {
    if (!hasRoleOrHigher(message.member, guildSettings.admin_role_id)) {
      return await message.channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('❌ Unauthorized')
          .setDescription('You must have the administrator role or higher to use this command.')
          .setColor('Red')]
      });
    }
  } else if (modCommands.includes(commandName)) {
    // Check mod permissions
    if (!hasRoleOrHigher(message.member, guildSettings.mod_role_id)) {
      return await message.channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('❌ Unauthorized')
          .setDescription('You must have the moderator role or higher to use this command.')
          .setColor('Red')]
      });
    }
  }

  // Run the command
  try {
    await command.execute(message, args);
  } catch (err) {
    console.error('Command execution error:', err);
    await message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('There was an error while executing this command.')
        .setColor('Red')]
    });
  }
});
