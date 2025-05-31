import supabase from './src/supabaseClient';
import { EmbedBuilder } from 'discord.js';
import { client } from '../index.js'; 

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
    return message.channel.send({
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
    return message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('⚠️ Roles Not Set')
        .setDescription('Please set the mod and admin roles first using `$setmod @role` and `$setadmin @role` commands.')
        .setColor('Yellow')]
    });
  }

  // Helper: check if user has a role or higher (roles are ordered by position)
  function hasRoleOrHigher(roleId) {
    const memberRoles = message.member.roles.cache;
    const targetRole = message.guild.roles.cache.get(roleId);
    if (!targetRole) return false;

    // User must have at least one role with equal or higher position than targetRole
    return memberRoles.some(r => r.position >= targetRole.position);
  }

  // Define which commands require mod/admin roles (you can expand this)
  const adminCommands = ['setadmin', 'ban', 'kick', 'mute', 'modlog' /* other admin-level commands */];
  const modCommands = ['setmod', 'modch', 'mute', 'kick', 'role', 'derole' /* other mod-level commands */];

  // Check permissions for admin commands
  if (adminCommands.includes(commandName)) {
    if (!hasRoleOrHigher(guildSettings.admin_role_id)) {
      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('❌ Unauthorized')
          .setDescription('You must have the administrator role or higher to use this command.')
          .setColor('Red')]
      });
    }
  } else if (modCommands.includes(commandName)) {
    if (!hasRoleOrHigher(guildSettings.mod_role_id)) {
      return message.channel.send({
        embeds: [new EmbedBuilder()
          .setTitle('❌ Unauthorized')
          .setDescription('You must have the moderator role or higher to use this command.')
          .setColor('Red')]
      });
    }
  }

  // If all checks pass, run the command
  try {
    await command.execute(message, args);
  } catch (err) {
    console.error(err);
    message.channel.send({
      embeds: [new EmbedBuilder()
        .setTitle('❌ Error')
        .setDescription('There was an error while executing this command.')
        .setColor('Red')]
    });
  }
});
