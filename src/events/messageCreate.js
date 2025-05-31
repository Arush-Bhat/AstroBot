import { supabase } from '../supabaseClient.js';
import { cmdErrorEmbed, cmdWarningEmbed } from '../utils/embeds.js';
import { logCommand } from '../utils/modlog.js';

// Helper: check if user has a role or higher
function hasRoleOrHigher(member, roleId) {
  if (!roleId) return false;
  const memberRoles = member.roles.cache;
  const targetRole = member.guild.roles.cache.get(roleId);
  if (!targetRole) return false;

  return memberRoles.some(r => r.position >= targetRole.position);
}

// Export default async function as event handler for 'messageCreate'
export default async function messageCreate(message, client) {
  if (message.author.bot) return;
  if (!message.content.startsWith('$')) return;

  const args = message.content.slice(1).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.commands.get(commandName);
  if (!command) return;

  // Fetch guild settings from Supabase
  const { data: guildSettings, error } = await supabase
    .from('guild_settings')
    .select('mod_role_id, admin_role_id, modch_channel_id')
    .eq('guild_id', message.guild.id)
    .single();

  if (error) {
    console.error('Supabase error:', error);
    return await cmdErrorEmbed(message, 'Could not fetch guild settings.');
  }

  // If mod/admin roles not set, except for setmod/setadmin commands
  if (
    (!guildSettings?.mod_role_id || !guildSettings?.admin_role_id) &&
    !['setmod', 'setadmin'].includes(commandName)
  ) {
    return await cmdWarningEmbed(
      message,
      'Please set the mod and admin roles first using `$setmod @role` and `$setadmin @role`.'
    );
  }

  // Allow 'modch' command without modch_channel_id set; all others require it
  if (
    commandName !== 'modch' &&
    !guildSettings?.modch_channel_id
  ) {
    // Delete the command message for cleanliness
    await message.delete().catch(() => {});
    return await cmdErrorEmbed(
      message,
      'Moderator commands channel is not set. Please set it first using `$modch #channel`.'
    );
  }

  // Check permission based on command.permissionLevel
  const perm = command.permissionLevel;

  if (perm === 'Admin') {
    if (!hasRoleOrHigher(message.member, guildSettings.admin_role_id)) {
      return await cmdErrorEmbed(message, 'You must have the administrator role or higher to use this command.');
    }
  } else if (perm === 'Mod') {
    if (!hasRoleOrHigher(message.member, guildSettings.mod_role_id)) {
      return await cmdErrorEmbed(message, 'You must have the moderator role or higher to use this command.');
    }
  }

  try {
    // Execute the command
    await command.execute(message, args);

    // Prepare log info for modlog
    let reason = null;
    let targetUserId = null;

    // Try to parse target user and reason from args if applicable
    if (args.length > 0) {
      // Check if first arg is user mention <@!id> or <@id>
      const userMentionMatch = args[0].match(/^<@!?(\d+)>$/);
      if (userMentionMatch) {
        targetUserId = userMentionMatch[1];
        // Reason might be everything after the first arg
        if (args.length > 1) {
          reason = args.slice(1).join(' ');
        }
      } else {
        // If no user mention, reason might be full args string (optional)
        reason = args.join(' ');
      }
    }

    // Detect if command was used in modch channel
    const isModch = message.channel.id === guildSettings.modch_channel_id;

    // Log the command usage
    await logCommand({
      client,
      supabase,
      message,
      commandName,
      reason,
      targetUserId,
      isModch,
    });

  } catch (err) {
    console.error('Command execution error:', err);
    await cmdErrorEmbed(message, 'There was an error while executing this command.');
  }
}
