import { supabase } from '../supabaseClient.js';
import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embedHelpers.js';
import { isModerator } from '../utils/permissions';

const permissionLevel = 'Mod';

const data = {
  name: 'yt', 
};

async function execute(message, args) {
  if (!await isModerator(message.member)) {
    return message.reply({
      embeds: [cmdErrorEmbed('Unauthorized', 'Only moderators can use this command.')],
    });
  }

  if (!args.length) {
    return message.reply({
      embeds: [cmdErrorEmbed('Usage', 'Use:\n• `$yt #channel` to set the updates channel\n• `$yt <YouTube URL>` to subscribe to a YouTube channel')],
    });
  }

  const channelMention = message.mentions.channels.first();
  const ytUrlPattern = /^https?:\/\/(www\.)?youtube\.com\/(c\/|@|channel\/)?[a-zA-Z0-9_\-]+/i;

  // Set YouTube updates channel
  if (channelMention) {
    const { error } = await supabase
      .from('yt_settings')
      .upsert({
        guild_id: message.guild.id,
        updates_channel_id: channelMention.id,
      }, { onConflict: ['guild_id'] });

    if (error) {
      console.error(error);
      return message.reply({
        embeds: [cmdErrorEmbed('Database Error', 'Failed to set updates channel. Please try again later.')],
      });
    }

    return message.reply({
      embeds: [cmdResponseEmbed('YouTube Updates Channel Set', `Updates will be posted in ${channelMention}`)],
    });
  }

  // Register YouTube channel URL to track
  if (ytUrlPattern.test(args[0])) {
    // Check if updates channel is set
    const { data: ytSetting } = await supabase
      .from('yt_settings')
      .select('updates_channel_id')
      .eq('guild_id', message.guild.id)
      .single();

    if (!ytSetting || !ytSetting.updates_channel_id) {
      return message.reply({
        embeds: [cmdErrorEmbed('Missing Update Channel', 'Please set an updates channel first using `$yt #channel`.')],
      });
    }

    const url = args[0];

    const { error } = await supabase
      .from('yt_channels')
      .upsert({
        guild_id: message.guild.id,
        url: url,
      }, { onConflict: ['guild_id'] });

    if (error) {
      console.error(error);
      return message.reply({
        embeds: [cmdErrorEmbed('Database Error', 'Failed to save YouTube channel. Please try again later.')],
      });
    }

    // --- You would implement a background job or webhook handler elsewhere ---
    // Example: periodically check these URLs for new uploads
    // When a new video is detected, send a message in ytSetting.updates_channel_id
    // You can add a helper function elsewhere that:
    // 1) Queries supabase yt_channels for URLs,
    // 2) Checks YouTube API for new videos,
    // 3) Sends embed messages to the update channel with video info

    return message.reply({
      embeds: [cmdResponseEmbed('YouTube Channel Subscribed', `Now tracking: ${url}`)],
    });
  }

  return message.reply({
    embeds: [cmdErrorEmbed('Invalid Argument', 'Please provide either a YouTube channel URL or tag a text channel.')],
  });
};

export default {
  permissionLevel,
  data,
  execute,
};
