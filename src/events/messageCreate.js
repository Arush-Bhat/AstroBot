import supabase from '../supabaseClient.js';
import { cmdErrorEmbed, cmdWarningEmbed } from '../utils/embeds.js';
import { logCommand } from '../utils/modlog.js';
import { DEFAULT_PREFIX } from '../config.js';

// Helper: check if user has a role or higher
function hasRoleOrHigher(member, roleId) {
  if (!roleId) return false;
  const memberRoles = member.roles.cache;
  const targetRole = member.guild.roles.cache.get(roleId);
  if (!targetRole) return false;

  return memberRoles.some(r => r.position >= targetRole.position);
}

export default async function messageCreate(message, client) {
  if (message.author.bot || !message.guild) return;

  const { data: guildSettings, error } = await supabase
    .from('guild_settings')
    .select('mod_role_id, admin_role_id, modch_channel_id, prefix')
    .eq('guild_id', message.guild.id)
    .single();

  const prefix = guildSettings?.prefix || DEFAULT_PREFIX;
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();
  const command = client.commands.get(commandName);
  if (!command) return;

  if (error || !guildSettings) {
    console.error('Supabase error:', error);
    return await cmdErrorEmbed(message, 'Could not fetch guild settings.');
  }

  const modchId = guildSettings?.modch_channel_id;
  const isModch = message.channel.id === modchId;
  console.log(isModch);

  // Block commands if mod/admin roles are missing
  if (
    (!guildSettings?.mod_role_id || !guildSettings?.admin_role_id) &&
    !['setmod', 'setadmin'].includes(commandName)
  ) {
    return await cmdWarningEmbed(
      message,
      `Please set the mod and admin roles using \`${prefix}setmod @role\` and \`${prefix}setadmin @role\`.`
    );
  }

  // Block if modch isn't set
  if (commandName !== 'modch' && !modchId) {
    await message.delete().catch(() => {});
    return await cmdErrorEmbed(
      message,
      `Moderator commands channel not set. Use \`${prefix}modch #channel\` first.`
    );
  }

  // Permission check
  const perm = command.permissionLevel;
  if (perm === 'Admin') {
    if (!hasRoleOrHigher(message.member, guildSettings.admin_role_id)) {
      return await cmdErrorEmbed(
        message,
        'You must have the administrator role or higher to use this command.'
      );
    }
  } else if (perm === 'Mod') {
    if (!hasRoleOrHigher(message.member, guildSettings.mod_role_id)) {
      return await cmdErrorEmbed(
        message,
        'You must have the moderator role or higher to use this command.'
      );
    }
  }

  try {
    const result = await command.execute(client, message, args, supabase);

    // Delete original message if not in modch (and not the modch command itself)
    if (modchId && !isModch) {
      await message.delete().catch(() => {});
    }

    // Handle reply
    if (result?.reply) {
      const modchChannel = message.guild.channels.cache.get(modchId);

      if (isModch || !modchId) {
        await message.reply(result.reply);
      } else if (modchChannel?.isTextBased()) {
        console.log(`✅ Sending command output to modch channel: ${modchChannel.name}`);
        await modchChannel.send({
          content: `**Command executed by ${message.author}:**`,
          embeds: result.reply.embeds ?? [],
          components: result.reply.components ?? [],
          files: result.reply.files ?? [],
        });
      } else {
        console.warn('⚠️ Modch channel is nots accessible or not text-based.');
      }
    }

    // Handle command logging
    if (result?.log) {
      await logCommand({
        client,
        supabase,
        message: result.message ?? message, // fallback to main message if result.message is missing
        ...result.log,
      });
    } else {
      const userMentionMatch = args[0]?.match(/^<@!?(\d+)>$/);
      const targetUserId = userMentionMatch?.[1] ?? null;
      const reason = targetUserId ? args.slice(1).join(' ') : args.join(' ');

      await logCommand({
        client,
        supabase,
        message,
        commandName,
        reason,
        targetUserId,
        isModch,
      });
    }
  } catch (err) {
    console.error(`Command execution error (${commandName}):`, err);
    await cmdErrorEmbed(message, 'There was an error while executing this command.');
  }
}
