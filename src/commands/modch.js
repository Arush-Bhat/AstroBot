import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

// Permission level required to use this command
const permissionLevel = 'Admin';

// Command metadata
const data = {
  name: 'modch',
  description: 'Set or view the mod commands channel. Admin-only command.',
  usage: '$modch #channel',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command modch.js executed with args:', args);
  const guildId = message.guild.id;
  const member = message.member;

  // Fetch admin role ID from the database for this guild
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
            '❌ Error fetching admin role from database.\n\nPlease try again later or contact support.'
          ),
        ],
      },
    };
  }

  const adminRoleId = adminData?.admin_role_id;

  // If no admin role is configured, prompt the user to set it up
  if (!adminRoleId) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Configuration Missing',
            '❌ Admin role not configured.\n\nPlease set the admin role first using `$setadmin @role`.'
          ),
        ],
      },
    };
  }

  // Check if the user has the admin role or Administrator permissions
  if (!member.roles.cache.has(adminRoleId) && !member.permissions.has('ADMINISTRATOR')) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Unauthorized',
            '❌ You need to have the Administrator role to use this command.'
          ),
        ],
      },
    };
  }

  // Fetch the currently set mod commands channel (if any)
  const { data: settingsData, error: settingsError } = await supabase
    .from('guild_settings')
    .select('modch_channel_id')
    .eq('guild_id', guildId)
    .single();

  if (settingsError) {
    console.error(settingsError);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Database Error',
            '❌ Error fetching mod commands channel. Please try again later.'
          ),
        ],
      },
    };
  }

  const modchId = settingsData?.modch_channel_id;
  const modchChannel = modchId ? message.guild.channels.cache.get(modchId) : null;

  // If no arguments are provided, show the currently set modch channel
  if (args.length === 0) {
    return {
      reply: {
        embeds: [
          cmdResponseEmbed(
            'Moderator Commands Channel',
            `🛠️ Current mod commands channel is: ${modchChannel ? modchChannel.toString() : 'N/A'}`
          ),
        ],
      },
    };
  }

  // Parse the mentioned channel from the first argument
  const channelMention = args[0];
  const channelIdMatch = channelMention.match(/^<#(\d+)>$/);
  if (!channelIdMatch) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Channel',
            '❌ Please mention a valid channel.\n\nUsage example: `$modch #channel`'
          ),
        ],
      },
    };
  }

  const channelId = channelIdMatch[1];
  const channel = message.guild.channels.cache.get(channelId);

  // Check if the mentioned channel actually exists in the server
  if (!channel) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Channel',
            '❌ The specified channel does not exist in this server.\n\nPlease mention a valid channel.'
          ),
        ],
      },
    };
  }

  // Check if the guild_settings row exists to decide between update or insert
  let { data: existing, error: fetchError } = await supabase
    .from('guild_settings')
    .select('guild_id')
    .eq('guild_id', guildId)
    .single();

  if (fetchError && fetchError.code === 'PGRST116') {
    // Row not found – insert with default prefix
    const { error: createError } = await supabase
      .from('guild_settings')
      .insert({ guild_id: guildId, prefix: '$' });

    if (createError) {
      console.error(createError);
      return {
        reply: {
          embeds: [
            cmdErrorEmbed(
              'Database Error',
              '❌ Failed to initialize server settings. Please try again later.'
            ),
          ],
        },
      };
    }

    // Re-fetch the row to proceed
    const result = await supabase
      .from('guild_settings')
      .select('guild_id')
      .eq('guild_id', guildId)
      .single();
    existing = result.data;
    fetchError = result.error;
  } else if (fetchError) {
    console.error(fetchError);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Database Error',
            '❌ Error while fetching guild settings. Please try again later.'
          ),
        ],
      },
    };
  }

  // Update existing row with new modch channel ID
  const { error: updateError } = await supabase
    .from('guild_settings')
    .update({ modch_channel_id: channelId })
    .eq('guild_id', guildId);

  if (updateError) {
    console.error(updateError);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Database Error',
            '❌ Failed to update mod commands channel. Please try again later.'
          ),
        ],
      },
    };
  }

  // Success: return confirmation and log the action
  return {
    reply: {
      embeds: [
        cmdResponseEmbed(
          'Mod Commands Channel Set',
          `✅ Moderator commands channel successfully changed to ${channel.toString()}`
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
}

// Export the command
export default {
  data,
  permissionLevel,
  execute,
};
