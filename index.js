import { EmbedBuilder, PermissionsBitField } from 'discord.js';

// Helpers to get and set channels in Supabase by guildId
async function getModCh(guildId) {
  const { data, error } = await supabase
    .from('settings')
    .select('modch_channel_id')
    .eq('guild_id', guildId)
    .single();
  return data?.modch_channel_id || null;
}

async function setModCh(guildId, channelId) {
  // Upsert logic for Supabase
  const { data, error } = await supabase
    .from('settings')
    .upsert({ guild_id: guildId, modch_channel_id: channelId }, { onConflict: 'guild_id' });
  return !error;
}

async function getModLogCh(guildId) {
  const { data, error } = await supabase
    .from('settings')
    .select('modlog_channel_id')
    .eq('guild_id', guildId)
    .single();
  return data?.modlog_channel_id || null;
}

async function setModLogCh(guildId, channelId) {
  const { data, error } = await supabase
    .from('settings')
    .upsert({ guild_id: guildId, modlog_channel_id: channelId }, { onConflict: 'guild_id' });
  return !error;
}

// Command handler snippet for modch and modlog
async function handleModChCommand(message, args) {
  const guildId = message.guild.id;

  if (args.length === 0) {
    // Just display current modch channel
    const current = await getModCh(guildId);
    const embed = new EmbedBuilder()
      .setTitle('Mod Commands Channel')
      .setDescription(current ? `<#${current}>` : 'N/A')
      .setColor('Blue');
    await message.channel.send({ embeds: [embed] });
  } else {
    // Set new modch channel - admin only
    if (!await isAdmin(message.member)) {
      return sendErrorEmbed(message, 'Only administrators can set the mod commands channel.');
    }
    const channelMention = args[0];
    const channelId = channelMention.replace(/[<#>]/g, '');
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel) {
      return sendErrorEmbed(message, 'Please mention a valid channel.');
    }

    const success = await setModCh(guildId, channelId);
    if (success) {
      const embed = new EmbedBuilder()
        .setTitle('Mod Commands Channel Set')
        .setDescription(`Mod commands channel has been set to <#${channelId}>.`)
        .setColor('Green');
      await message.channel.send({ embeds: [embed] });
    } else {
      sendErrorEmbed(message, 'Failed to set mod commands channel.');
    }
  }
}

async function handleModLogCommand(message, args) {
  const guildId = message.guild.id;

  if (args.length === 0) {
    const current = await getModLogCh(guildId);
    const embed = new EmbedBuilder()
      .setTitle('Mod Log Channel')
      .setDescription(current ? `<#${current}>` : 'N/A')
      .setColor('Blue');
    await message.channel.send({ embeds: [embed] });
  } else {
    if (!await isAdmin(message.member)) {
      return sendErrorEmbed(message, 'Only administrators can set the mod log channel.');
    }
    const channelMention = args[0];
    const channelId = channelMention.replace(/[<#>]/g, '');
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel) {
      return sendErrorEmbed(message, 'Please mention a valid channel.');
    }

    const success = await setModLogCh(guildId, channelId);
    if (success) {
      const embed = new EmbedBuilder()
        .setTitle('Mod Log Channel Set')
        .setDescription(`Mod log channel has been set to <#${channelId}>.`)
        .setColor('Green');
      await message.channel.send({ embeds: [embed] });
    } else {
      sendErrorEmbed(message, 'Failed to set mod log channel.');
    }
  }
}

// Use these in your command dispatcher, e.g.
if (command === 'modch') {
  await handleModChCommand(message, args);
} else if (command === 'modlog') {
  await handleModLogCommand(message, args);
}

// Helper: send error embed
function sendErrorEmbed(message, text) {
  const embed = new EmbedBuilder()
    .setTitle('Error')
    .setDescription(text)
    .setColor('Red');
  return message.channel.send({ embeds: [embed], ephemeral: true });
}
