import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

// Required permission level to run this command
const permissionLevel = 'Admin';

// Command metadata
const data = {
  name: 'modlog',
  description: 'Set or view the moderator log channel. Admin-only command.',
  usage: '$modlog #channel',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command modlog.js executed with args:', args);
  const guildId = message.guild.id;
  const member = message.member;

  // Fetch the admin role ID for this guild from the database
  const { data: adminData, error: adminError } = await supabase
    .from('guild_settings')
    .select('admin_role_id')
    .eq('guild_id', guildId)
    .single();

  if (adminError) {
    console.error(adminError);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Database Error',
            '❌ Error fetching admin role from database.\n\n' +
            'Please try again later or contact support.'
          ),
        ],
      },
    };
  }

  const adminRoleId = adminData?.admin_role_id;

  // Check if an admin role is configured
  if (!adminRoleId) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Missing Admin Role',
            '⚠️ No admin role set for this server.\n\n' +
            'Use `$setadmin @role` to set an administrator role before using this command.'
          ),
        ],
      },
    };
  }

  // Check if the user has the admin role or ADMINISTRATOR permissions
  if (!member.roles.cache.has(adminRoleId) && !member.permissions.has('ADMINISTRATOR')) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Unauthorized',
            '❌ You need the Administrator role or permissions to use this command.'
          ),
        ],
      },
    };
  }

  // If no arguments are provided, display the currently set modlog channel
  if (args.length === 0) {
    const { data, error } = await supabase
      .from('guild_settings')
      .select('modlog_channel_id')
      .eq('guild_id', guildId)
      .single();

    if (error) {
      console.error(error);
      return {
        reply: {
          embeds: [
            cmdErrorEmbed(
              'Database Error',
              '❌ Failed to fetch the modlog channel from the database.'
            ),
          ],
        },
      };
    }

    const modlogId = data?.modlog_channel_id;
    const modlogChannel = modlogId ? message.guild.channels.cache.get(modlogId) : null;

    return {
      reply: {
        embeds: [
          cmdResponseEmbed(
            'Moderator Log Channel',
            `📝 Current moderator log channel: ${modlogChannel ? modlogChannel.toString() : 'N/A'}`
          ),
        ],
      },
    };
  }

  // If an argument is provided, validate that it's a proper channel mention
  const channelMention = args[0];
  const channelIdMatch = channelMention.match(/^<#(\d+)>$/);
  if (!channelIdMatch) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Channel',
            '❌ Please mention a valid text channel.\n\nUsage example: `$modlog #channel`'
          ),
        ],
      },
    };
  }

  const channelId = channelIdMatch[1];
  const channel = message.guild.channels.cache.get(channelId);

  // Check if the mentioned channel exists in the server
  if (!channel) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Channel',
            '❌ The specified channel does not exist in this server.\n\n' +
            'Make sure to mention a channel from this server.'
          ),
        ],        
      },
    };
  }

  // Check if guild settings already exist in the database
  const { data: existing, error: fetchError } = await supabase
    .from('guild_settings')
    .select('guild_id')
    .eq('guild_id', guildId)
    .single();

  // If error other than "no rows", return a database error
  if (fetchError && fetchError.code !== 'PGRST116') {
    console.error(fetchError);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Database Error',
            '❌ Error while fetching guild settings.\n\nPlease try again later.'
          ),
        ],        
      },
    };
  }

  // If record exists, update the modlog channel
  if (existing) {
    const { error: updateError } = await supabase
      .from('guild_settings')
      .update({ modlog_channel_id: channelId })
      .eq('guild_id', guildId);

    if (updateError) {
      console.error(updateError);
      return {
        reply: {
          embeds: [
            cmdErrorEmbed(
              'Database Error',
              '❌ Failed to update the modlog channel.\n\nPlease try again later.'
            ),
          ],          
        },
      };
    }
  } else {
    // If no record exists, insert a new one with the modlog channel
    const { error: insertError } = await supabase
      .from('guild_settings')
      .insert({ guild_id: guildId, modlog_channel_id: channelId });

    if (insertError) {
      console.error(insertError);
      return {
        reply: {
          embeds: [
            cmdErrorEmbed(
              'Database Error',
              '❌ Failed to insert the modlog channel.\n\nPlease try again later.'
            ),
          ],          
        },
      };
    }
  }

  // Successfully set the modlog channel
  return {
    reply: {
      embeds: [
        cmdResponseEmbed(
          'Mod Log Channel Set',
          `✅ Moderator log channel successfully set to ${channel.toString()}`
        ),
      ],
    },
    // Log object for internal use or audit purposes
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
