// src/utils/modlog.js

import { EmbedBuilder } from 'discord.js';

/**
 * Logs a moderation action to the mod log channel.
 * 
 * @param {Client} client - Your Discord client
 * @param {string} guildId - ID of the guild where action happened
 * @param {Object} supabase - Supabase client instance
 * @param {string} action - Action name (e.g., "Ban", "Kick", "Mute")
 * @param {GuildMember} target - The user who the action was done on
 * @param {GuildMember} moderator - The user who performed the action
 * @param {string} reason - Reason for the action
 * @param {boolean} success - Whether the action succeeded
 * @param {boolean} inModCh - Whether the command was run in mod channel
 */
async function logModAction(client, guildId, supabase, action, target, moderator, reason, success, inModCh) {
  try {
    // Get modlog channel ID from Supabase
    let { data, error } = await supabase
      .from('guild_settings')
      .select('modlog_channel')
      .eq('guild_id', guildId)
      .single();

    if (error || !data?.modlog_channel) return;

    const modlogChannel = await client.channels.fetch(data.modlog_channel).catch(() => null);
    if (!modlogChannel) return;

    const embed = new EmbedBuilder()
      .setTitle(`Moderation Action: ${action}`)
      .setColor(success ? 0x2ecc71 : 0xe74c3c) // green if success else red
      .addFields(
        { name: 'User', value: `${target.user.tag} (${target.id})`, inline: true },
        { name: 'Moderator', value: `${moderator.user.tag} (${moderator.id})`, inline: true },
        { name: 'Reason', value: reason || 'No reason provided', inline: false },
        { name: 'Success', value: success ? 'Yes' : 'No', inline: true },
        { name: 'In Mod Channel', value: inModCh ? 'Yes' : 'No', inline: true },
        { name: 'Timestamp', value: new Date().toUTCString(), inline: false }
      )
      .setFooter({ text: `User ID: ${target.id}` })
      .setTimestamp();

    modlogChannel.send({ embeds: [embed] });
  } catch (err) {
    console.error('Failed to log moderation action:', err);
  }
}

export default logModAction;
