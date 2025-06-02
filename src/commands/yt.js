import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';
import { isModerator } from '../utils/permissions.js';
import {
  extractChannelIdFromUrl,
  fetchChannelIdFromUsername,
  fetchLatestVideo
} from '../utils/ytchecker.js';

const permissionLevel = 'Mod';

const data = {
  name: 'yt',
  description: 'Set YouTube updates channel or subscribe to YouTube channel URLs.',
  usage: '$yt #channel OR $yt <YouTube URL> OR $yt <YouTube URL> latest',
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
            '• `$yt https://youtube.com/@channelname` → Subscribe to channel\n' +
            '• `$yt https://youtube.com/@channelname latest` → Post latest video immediately'
          ),
        ],
      },
    };
  }

  const channelMention = message.mentions.channels.first();

  // Regex to detect valid YouTube channel URLs
  const ytUrlPattern = /^https?:\/\/(www\.)?youtube\.com\/(channel\/[A-Za-z0-9_\-]{24}|c\/[A-Za-z0-9_\-]+|@[\w\-]+)(\/.*)?$/i;

  // Handle updates channel setup
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
              '❌ Failed to set the YouTube updates channel.\n\nPlease try again later or contact support.'
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

  // Handle subscription or "latest" command
  if (ytUrlPattern.test(args[0])) {
    const url = args[0];
    const isLatestRequested = args[1]?.toLowerCase() === 'latest';

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

    const updatesChannel = message.guild.channels.cache.get(ytSetting.updates_channel_id);
    if (!updatesChannel || !updatesChannel.isTextBased()) {
      return {
        reply: {
          embeds: [
            cmdErrorEmbed(
              'Invalid Channel',
              '❌ The updates channel configured is not accessible or not a text channel.'
            ),
          ],
        },
      };
    }

    // Get the YouTube channel ID
    let channelId = extractChannelIdFromUrl(url);
    if (!channelId) {
      try {
        const path = new URL(url).pathname;
        const parts = path.split('/').filter(Boolean);
        let candidate = parts[parts.length - 1];
        if (candidate.startsWith('@')) candidate = candidate.slice(1);
        channelId = await fetchChannelIdFromUsername(candidate);
      } catch {
        return {
          reply: {
            embeds: [
              cmdErrorEmbed(
                'Invalid YouTube URL',
                '❌ Could not parse or resolve that YouTube channel URL.'
              ),
            ],
          },
        };
      }
    }

    // If `latest` keyword is provided, fetch and post latest video
    if (isLatestRequested) {
      const latest = await fetchLatestVideo(channelId);
      if (!latest) {
        return {
          reply: {
            embeds: [
              cmdErrorEmbed(
                'No Videos Found',
                '❌ No uploaded videos found for that channel.'
              ),
            ],
          },
        };
      }

      await updatesChannel.send(
        `📢 New video uploaded on YouTube:\n**${latest.title}**\nhttps://youtu.be/${latest.id}`
      );

      return {
        reply: {
          embeds: [
            cmdResponseEmbed(
              'Latest Video Posted',
              `✅ Latest video from ${url} posted to ${updatesChannel}.`
            ),
          ],
        },
      };
    }

    // Otherwise, save to database as a subscription
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
              '❌ Failed to subscribe to YouTube channel.\n\nCheck the URL format and try again.'
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

  // Invalid input fallback
  return {
    reply: {
      embeds: [
        cmdErrorEmbed(
          'Invalid Argument',
          '❌ That input wasn’t recognized.\n\n' +
          '**Expected:** A YouTube channel URL or a channel mention.\n\n' +
          '**Examples:**\n' +
          '• `$yt #yt-updates`\n' +
          '• `$yt https://youtube.com/@astrochannel`\n' +
          '• `$yt https://youtube.com/@astrochannel latest`'
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
