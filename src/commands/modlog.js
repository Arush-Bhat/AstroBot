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
      reply: [
        cmdErrorEmbed(
          'Database Error',
          '❌ Error fetching admin role from database.\n\n' +
          'Please try again later or contact support.'
        )
      ],
    };
  }

  const adminRoleId = adminData?.admin_role_id;

  if (!adminRoleId) {
    return {
      reply: [
        cmdErrorEmbed(
          'Missing Admin Role',
          '⚠️ No admin role set for this server.\n\n' +
          'Use `$setadmin @role` to set an administrator role before using this command.'
        )
      ],
    };
  }

  if (!member.roles.cache.has(adminRoleId) && !member.permissions.has('ADMINISTRATOR')) {
    return {
      reply: [
        cmdErrorEmbed(
          'Unauthorized',
          '❌ You need the Administrator role or permissions to use this command.'
        )
      ],
    };
  }

  // If no args, show current modlog channel
  if (args.length === 0) {
    const { data, error } = await supabase
      .from('guild_settings')
      .select('modlog_channel_id')
      .eq('guild_id', guildId)
      .single();

    if (error) {
      console.error(error);
      return {
        reply: [
          cmdErrorEmbed(
            'Database Error',
            '❌ Failed to fetch the modlog channel from the database.'
          )
        ],
      };
    }

    const modlogId = data?.modlog_channel_id;
    const modlogChannel = modlogId ? message.guild.channels.cache.get(modlogId) : null;

    return {
      reply: [
        cmdResponseEmbed(
          'Moderator Log Channel',
          `📝 Current moderator log channel: ${modlogChannel ? modlogChannel.toString() : 'N/A'}`
        )
      ],
    };
  }

  // Validate channel mention
  const channelMention = args[0];
  const channelIdMatch = channelMention.match(/^<#(\d+)>$/);
  if (!channelIdMatch) {
    return {
      reply: [
        cmdErrorEmbed(
          'Invalid Channel',
          '❌ Please mention a valid text channel.\n\nUsage example: `$modlog #channel`'
        )
      ],
    };
  }

  const channelId = channelIdMatch[1];
  const channel = message.guild.channels.cache.get(channelId);

  if (!channel) {
    return {
      reply: [
        cmdErrorEmbed(
          'Invalid Channel',
          '❌ The specified channel does not exist in this server.\n\n' +
          'Make sure to mention a channel from this server.'
        )
      ],
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
      reply: [
        cmdErrorEmbed(
          'Database Error',
          '❌ Error while fetching guild settings.\n\nPlease try again later.'
        )
      ],
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
        reply: [
          cmdErrorEmbed(
            'Database Error',
            '❌ Failed to update the modlog channel.\n\nPlease try again later.'
          )
        ],
      };
    }
  } else {
    const { error: insertError } = await supabase
      .from('guild_settings')
      .insert({ guild_id: guildId, modlog_channel_id: channelId });

    if (insertError) {
      console.error(insertError);
      return {
        reply: [
          cmdErrorEmbed(
            'Database Error',
            '❌ Failed to insert the modlog channel.\n\nPlease try again later.'
          )
        ],
      };
    }
  }

  return {
    reply: [
      cmdResponseEmbed(
        'Mod Log Channel Set',
        `✅ Moderator log channel successfully set to ${channel.toString()}`
      )
    ],
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
