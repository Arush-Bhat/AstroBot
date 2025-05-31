import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Admin';

const data = {
  name: 'modch',
  description: 'Set or get the moderator commands channel. Administrator-level command.',
};

async function execute(client, message, args, supabase) {
  const guildId = message.guild.id;
  const member = message.member;

  // Fetch admin role
  const { data: adminData, error: adminError } = await supabase
    .from('guild_settings')
    .select('admin_role_id')
    .eq('guild_id', guildId)
    .single();

  if (adminError) {
    console.error(adminError);
    return {
      reply: { embeds: [cmdErrorEmbed('Error', 'Error fetching admin role from database.')] },
    };
  }

  const adminRoleId = adminData?.admin_role_id;

  if (!adminRoleId) {
    return {
      reply: { embeds: [cmdErrorEmbed('Missing Admin Role', 'Use `$setadmin @role` first.')] },
    };
  }

  if (!member.roles.cache.has(adminRoleId) && !member.permissions.has('ADMINISTRATOR')) {
    return {
      reply: { embeds: [cmdErrorEmbed('Unauthorized', 'Administrator role required.')] },
    };
  }

  // Fetch modch channel
  const { data: settingsData, error: settingsError } = await supabase
    .from('guild_settings')
    .select('modch_channel_id')
    .eq('guild_id', guildId)
    .single();

  if (settingsError) {
    console.error(settingsError);
    return {
      reply: { embeds: [cmdErrorEmbed('Error', 'Error fetching mod commands channel.')] },
    };
  }

  const modchId = settingsData?.modch_channel_id;
  const modchChannel = modchId ? message.guild.channels.cache.get(modchId) : null;

  if (args.length === 0) {
    return {
      reply: {
        embeds: [
          cmdResponseEmbed(
            'Moderator Commands Channel',
            `🛠️ Current mod commands channel is: ${modchChannel ? modchChannel.toString() : 'N/A'}`,
            'Green'
          ),
        ],
      },
    };
  }

  const channelMention = args[0];
  const channelIdMatch = channelMention.match(/^<#(\d+)>$/);
  if (!channelIdMatch) {
    return {
      reply: { embeds: [cmdErrorEmbed('Invalid Channel', 'Please mention a valid channel. Usage: `$modch #channel`.')] },
    };
  }

  const channelId = channelIdMatch[1];
  const channel = message.guild.channels.cache.get(channelId);

  if (!channel) {
    return {
      reply: { embeds: [cmdErrorEmbed('Invalid Channel', 'The specified channel does not exist in this server.')] },
    };
  }

  // Upsert modch_channel_id
  const { data: existing, error: fetchError } = await supabase
    .from('guild_settings')
    .select('guild_id')
    .eq('guild_id', guildId)
    .single();

  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error(fetchError);
    return {
      reply: { embeds: [cmdErrorEmbed('Database Error', 'Error while fetching guild settings.')] },
    };
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('guild_settings')
      .update({ modch_channel_id: channelId })
      .eq('guild_id', guildId);

    if (updateError) {
      console.error(updateError);
      return {
        reply: { embeds: [cmdErrorEmbed('Database Error', 'Failed to update mod commands channel.')] },
      };
    }
  } else {
    const { error: insertError } = await supabase
      .from('guild_settings')
      .insert({ guild_id: guildId, modch_channel_id: channelId });

    if (insertError) {
      console.error(insertError);
      return {
        reply: { embeds: [cmdErrorEmbed('Database Error', 'Failed to insert mod commands channel.')] },
      };
    }
  }

  return {
    reply: {
      embeds: [
        cmdResponseEmbed(
          'Mod Commands Channel Set',
          `✅ Moderator commands channel set to ${channel.toString()}`,
          'Green'
        ),
      ],
    },
    log: {
      action: 'modch_set',
      executorUserId: message.author.id,
      executorTag: message.author.tag,
      guildId,
      channelId,
      channelName: channel.name,
      timestamp: new Date().toISOString(),
    },
  };
};

export default {
  permissionLevel,
  data,
  execute,
};