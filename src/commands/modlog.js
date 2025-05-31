import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Admin';

const data = {
  name: 'modlog',
  description: 'Set or view the moderator log channel. Admin-only command.',
  usage: '$modlog #channel',
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

  // View current modlog channel
  if (args.length === 0) {
    const { data, error } = await supabase
      .from('guild_settings')
      .select('modlog_channel_id')
      .eq('guild_id', guildId)
      .single();

    if (error) {
      console.error(error);
      return {
        reply: { embeds: [cmdErrorEmbed('Error', 'Error fetching modlog channel from database.')] },
      };
    }

    const modlogId = data?.modlog_channel_id;
    const modlogChannel = modlogId ? message.guild.channels.cache.get(modlogId) : null;

    return {
      reply: {
        embeds: [
          cmdResponseEmbed(
            'Moderator Log Channel',
            `📝 Moderator log channel is: ${modlogChannel ? modlogChannel.toString() : 'N/A'}`,
            'Green'
          ),
        ],
      },
    };
  }

  // Validate channel mention
  const channelMention = args[0];
  const channelIdMatch = channelMention.match(/^<#(\d+)>$/);
  if (!channelIdMatch) {
    return {
      reply: { embeds: [cmdErrorEmbed('Invalid Channel', 'Please mention a valid channel. Usage: `$modlog #channel`.')] },
    };
  }

  const channelId = channelIdMatch[1];
  const channel = message.guild.channels.cache.get(channelId);

  if (!channel) {
    return {
      reply: { embeds: [cmdErrorEmbed('Invalid Channel', 'The specified channel does not exist in this server.')] },
    };
  }

  // Upsert modlog_channel_id
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
      .update({ modlog_channel_id: channelId })
      .eq('guild_id', guildId);

    if (updateError) {
      console.error(updateError);
      return {
        reply: { embeds: [cmdErrorEmbed('Database Error', 'Failed to update modlog channel.')] },
      };
    }
  } else {
    const { error: insertError } = await supabase
      .from('guild_settings')
      .insert({ guild_id: guildId, modlog_channel_id: channelId });

    if (insertError) {
      console.error(insertError);
      return {
        reply: { embeds: [cmdErrorEmbed('Database Error', 'Failed to insert modlog channel.')] },
      };
    }
  }

  return {
    reply: {
      embeds: [
        cmdResponseEmbed(
          'Mod Log Channel Set',
          `✅ Moderator log channel set to ${channel.toString()}`,
          'Green'
        ),
      ],
    },
    log: {
      action: 'modlog_set',
      executorUserId: message.author.id,
      executorTag: message.author.tag,
      guildId,
      channelId,
      channelName: channel.name,
      timestamp: new Date().toISOString(),
    },
  };
}

export default {
  data,
  permissionLevel,
  execute,
};