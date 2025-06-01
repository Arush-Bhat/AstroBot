import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';
import { isModerator } from '../utils/permissions.js';

const permissionLevel = 'Mod';

const data = {
  name: 'yt',
  description: 'Set YouTube updates channel or subscribe to YouTube channel URLs.',
  usage: '$yt #channel OR $yt <YouTube URL>',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command yt.js executed with args:', args);
  const member = message.member;

  // Check permission
  if (!(await isModerator(member, supabase))) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Permission Denied',
            '❌ Only moderators can use this command.\n\n' +
            'Ask an admin to assign you the correct role or use `$setmod @role` to configure.'
          ),
        ],
      },
    };
  }

  // Check for arguments
  if (!args.length) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Missing Arguments',
            '❌ You must provide either a channel mention or a YouTube channel URL.\n\n' +
            '**Usage:**\n' +
            '• `$yt #channel` → Set update channel\n' +
            '• `$yt https://youtube.com/@channelname` → Subscribe to channel'
          ),
        ],
      },
    };
  }

  // Handle channel mention
  const channelMention = message.mentions.channels.first();

  // Regex for YouTube channel URLs
  const ytUrlPattern = /^https?:\/\/(www\.)?youtube\.com\/(c\/|@|channel\/)?[a-zA-Z0-9_\-]+/i;

  if (channelMention) {
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
          embeds: [
            cmdErrorEmbed(
              'Database Error',
              '❌ Failed to set the YouTube updates channel.\n\n' +
              'Please try again later or contact support.'
            ),
          ],
        },
      };
    }

    return {
      reply: {
        embeds: [
          cmdResponseEmbed(
            'YouTube Updates Channel Set',
            `✅ YouTube updates will now be posted in ${channelMention}.`
          ),
        ],
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

  // Handle YouTube URL
  if (ytUrlPattern.test(args[0])) {
    const { data: ytSetting, error: ytSettingError } = await supabase
      .from('yt_settings')
      .select('updates_channel_id')
      .eq('guild_id', message.guild.id)
      .single();

    if (ytSettingError || !ytSetting?.updates_channel_id) {
      return {
        reply: {
          embeds: [
            cmdErrorEmbed(
              'Missing Updates Channel',
              '❌ Please set an updates channel first using:\n`$yt #channel`.'
            ),
          ],
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
          embeds: [
            cmdErrorEmbed(
              'Database Error',
              '❌ Failed to subscribe to YouTube channel.\n\n' +
              'Check the URL format and try again.'
            ),
          ],
        },
      };
    }

    return {
      reply: {
        embeds: [
          cmdResponseEmbed(
            'YouTube Channel Subscribed',
            `📺 Now tracking: ${url}`
          ),
        ],
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

  // Invalid input
  return {
    reply: {
      embeds: [
        cmdErrorEmbed(
          'Invalid Argument',
          '❌ That input wasn’t recognized.\n\n' +
          '**Expected:** A YouTube channel URL or a channel mention.\n\n' +
          '**Examples:**\n' +
          '• `$yt #yt-updates`\n' +
          '• `$yt https://youtube.com/@astrochannel`'
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
