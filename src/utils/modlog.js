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

  // Build embed
  const embed = new EmbedBuilder()
    .setColor(0x0099ff)
    .setTitle('Command Executed')
    .addFields(
      { name: 'Command', value: commandName, inline: true },
      { name: 'Used By', value: `${usedBy.tag} (${usedBy.id})`, inline: true },
      { name: 'Target User', value: targetUserId ? `<@${targetUserId}>` : 'N/A', inline: true },
      { name: 'Used At (IST)', value: usedAt, inline: true },
      { name: 'Channel', value: `${usedInChannel.name} (${usedInChannel.id})`, inline: true },
      { name: 'Used In Modch?', value: isModch ? 'Yes' : 'No', inline: true },
    );

  if (reason && !reason.match(/^<#\d+>$/)) {
    embed.addFields({ name: 'Reason', value: reason });
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
