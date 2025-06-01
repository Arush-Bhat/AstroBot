import { EmbedBuilder } from 'discord.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
dayjs.extend(utc);
dayjs.extend(timezone);

export async function logCommand({
  client,
  supabase,
  message,
  commandName,
  reason = null,
  targetUserId = null,
  isModch = false,
}) {
  if (!message || !message.guild) {
    console.warn('logCommand: Missing message or guild in parameters');
    return;
  }

  const guildId = message.guild.id;
  const usedBy = message.author;
  const usedInChannel = message.channel;

  // Format IST time
  const usedAt = dayjs().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');

  // Defensive: ensure all fields are strings
  const safeCommandName = String(commandName ?? 'N/A');
  const safeUsedBy = `${usedBy.tag ?? 'Unknown#0000'} (${usedBy.id ?? 'N/A'})`;
  const safeTargetUser = targetUserId ? `<@${targetUserId}>` : 'N/A';
  const safeUsedAt = String(usedAt);
  const safeChannel = `${usedInChannel.name ?? 'unknown'} (${usedInChannel.id ?? 'N/A'})`;
  const safeIsModch = isModch ? 'Yes' : 'No';
  const safeReason = reason && !reason.match(/^<#\d+>$/) ? String(reason) : null;

  // Build embed
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('Command Executed')
    .addFields(
      { name: 'Command', value: safeCommandName, inline: true },
      { name: 'Used By', value: safeUsedBy, inline: true },
      { name: 'Target User', value: safeTargetUser, inline: true },
      { name: 'Used At (IST)', value: safeUsedAt, inline: true },
      { name: 'Channel', value: safeChannel, inline: true },
      { name: 'Used In Modch?', value: safeIsModch, inline: true }
    );

  if (safeReason) {
    embed.addFields({ name: 'Reason', value: safeReason });
  }

  // Send embed to modlog channel if set
  try {
    const { data: guildSettings, error } = await supabase
      .from('guild_settings')
      .select('modlog_channel_id')
      .eq('guild_id', guildId)
      .single();

    if (error) {
      console.error('Supabase error fetching guild_settings:', error);
      return;
    }

    if (guildSettings?.modlog_channel_id) {
      const modlogChannel = client.channels.cache.get(guildSettings.modlog_channel_id);
      if (!modlogChannel || !modlogChannel.isTextBased()) {
        console.warn('logCommand: modlog channel invalid or not text based');
        return;
      }

      try {
        await modlogChannel.send({ embeds: [embed] });
      } catch (sendErr) {
        console.error('Error sending modlog embed:', sendErr);
      }
    }
  } catch (err) {
    console.error('Error fetching modlog channel or sending embed:', err);
  }

  // Insert backup log into Supabase - append new row instead of upsert
  try {
    await supabase.from('log_backup').insert({
      guild_id: guildId,
      command_used: commandName,
      reason: reason,
      command_user: usedBy.id,
      target_user: targetUserId,
      used_at: usedAt,
      used_in: new Date(message.createdTimestamp),
      is_modch: isModch,
    });
  } catch (err) {
    console.error('Error inserting log_backup:', err);
  }
}
