import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';
import { isModerator } from '../utils/permissions.js';

const permissionLevel = 'Mod';

const data = {
  name: 'yt',
  description: 'Set YouTube updates channel or subscribe to YouTube channel URLs.',
  usage: '$yt #channel OR $yt <YouTube URL>',
};

async function execute(client, message, args, supabase) {
  const member = message.member;

  // Check permission using your helper
  if (!(await isModerator(member, supabase))) {
    return {
      reply: {
        embeds: [cmdErrorEmbed('Unauthorized', 'Only moderators can use this command.')],
      },
    };
  }

  if (!args.length) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Usage',
            'Use:\n• `$yt #channel` to set the updates channel\n• `$yt <YouTube URL>` to subscribe to a YouTube channel'
          ),
        ],
      },
    };
  }

  // Check if a channel was mentioned
  const channelMention = message.mentions.channels.first();

  // Regex for YouTube channel URLs (c/, @, channel/)
  const ytUrlPattern = /^https?:\/\/(www\.)?youtube\.com\/(c\/|@|channel\/)?[a-zA-Z0-9_\-]+/i;

  if (channelMention) {
    // Set updates channel in database
    const { error } = await supabase
      .from('yt_settings')
      .upsert(
        {
          guild_id: message.guild.id,
          updates_channel_id: channelMention.id,
        },
        { onConflict: ['guild_id'] }
      );

    if (error) {
      console.error(error);
      return {
        reply: {
          embeds: [cmdErrorEmbed('Database Error', 'Failed to set updates channel. Please try again later.')],
        },
      };
    }

    return {
      reply: {
        embeds: [cmdResponseEmbed('YouTube Updates Channel Set', `Updates will be posted in ${channelMention}`)],
      },
      log: {
        action: 'yt_updates_channel_set',
        executorUserId: message.author.id,
        executorTag: message.author.tag,
        guildId: message.guild.id,
        channelId: channelMention.id,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // If argument matches a YouTube channel URL, subscribe to it
  if (ytUrlPattern.test(args[0])) {
    // Ensure updates channel is set
    const { data: ytSetting, error: ytSettingError } = await supabase
      .from('yt_settings')
      .select('updates_channel_id')
      .eq('guild_id', message.guild.id)
      .single();

    if (ytSettingError || !ytSetting || !ytSetting.updates_channel_id) {
      return {
        reply: {
          embeds: [cmdErrorEmbed('Missing Update Channel', 'Please set an updates channel first using `$yt #channel`.')],
        },
      };
    }

    const url = args[0];

    const { error } = await supabase
      .from('yt_channels')
      .upsert(
        {
          guild_id: message.guild.id,
          url,
        },
        { onConflict: ['guild_id', 'url'] }
      );

    if (error) {
      console.error(error);
      return {
        reply: {
          embeds: [cmdErrorEmbed('Database Error', 'Failed to save YouTube channel. Please try again later.')],
        },
      };
    }

    return {
      reply: {
        embeds: [cmdResponseEmbed('YouTube Channel Subscribed', `Now tracking: ${url}`)],
      },
      log: {
        action: 'yt_channel_subscribed',
        executorUserId: message.author.id,
        executorTag: message.author.tag,
        guildId: message.guild.id,
        url,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // If none matched, invalid argument
  return {
    reply: {
      embeds: [
        cmdErrorEmbed(
          'Invalid Argument',
          'Please provide either a YouTube channel URL or tag a text channel.'
        ),
      ],
    },
  };
}

export default {
  data,
  permissionLevel,
  execute,
};
