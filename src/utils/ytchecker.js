import supabase from '../supabaseClient.js';
import fetch from 'node-fetch';

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!YOUTUBE_API_KEY) {
  console.warn('⚠️ YOUTUBE_API_KEY not set in environment variables.');
}

/**
 * Extract YouTube channel ID from URL.
 * Supports URLs like:
 * - https://youtube.com/channel/CHANNEL_ID
 * - https://youtube.com/c/CustomName
 * - https://youtube.com/@username
 * Returns the channelId string or null if invalid.
 */
export function extractChannelIdFromUrl(url) {
  try {
    const u = new URL(url);

    // Handle channel ID URL
    if (u.pathname.startsWith('/channel/')) {
      return u.pathname.split('/')[2];
    }

    // Handle custom name / user or @username URLs
    if (
      u.pathname.startsWith('/c/') ||
      u.pathname.startsWith('/user/') ||
      u.pathname.startsWith('/@')
    ) {
      return null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch YouTube channel ID from username/custom URL or @username by calling YouTube API channels.list
 * Returns channelId string or null if not found.
 */
export async function fetchChannelIdFromUsername(usernameOrCustom) {
  if (!usernameOrCustom) return null;
  const url = `https://www.googleapis.com/youtube/v3/channels?part=id&forUsername=${usernameOrCustom}&key=${YOUTUBE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.items?.length) {
    return data.items[0].id;
  }
  return null;
}

/**
 * Fetch the latest video from a channel ID
 * Returns { id: string, title: string } or null if none found
 */
export async function fetchLatestVideo(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/search?key=${YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=1&type=video`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('YouTube API error:', await res.text());
    return null;
  }
  const data = await res.json();
  if (!data.items?.length) return null;
  const video = data.items[0];
  return {
    id: video.id.videoId,
    title: video.snippet.title,
  };
}

/**
 * Main function to check YouTube updates for all guilds
 * @param {import('discord.js').Client} client
 */
export async function checkYouTubeUpdates(client) {
  if (!YOUTUBE_API_KEY) {
    console.warn('Cannot check YouTube updates without API key.');
    return;
  }

  // Fetch all subscriptions: guild + channel URLs
  const { data: subscriptions, error } = await supabase
    .from('yt_channels')
    .select('guild_id, url');

  if (error) {
    console.error('Error fetching yt_channels:', error);
    return;
  }

  for (const sub of subscriptions) {
    const { guild_id, url } = sub;

    // Get update channel id for this guild
    const { data: setting, error: settingError } = await supabase
      .from('yt_settings')
      .select('updates_channel_id')
      .eq('guild_id', guild_id)
      .single();

    if (settingError || !setting?.updates_channel_id) {
      console.log(`No updates channel set for guild ${guild_id}`);
      continue;
    }

    // Extract or resolve channel ID
    let channelId = extractChannelIdFromUrl(url);

    if (!channelId) {
      try {
        const path = new URL(url).pathname;
        const parts = path.split('/').filter(Boolean);
        let candidate = parts[parts.length - 1]; // last part

        if (candidate.startsWith('@')) candidate = candidate.slice(1);

        channelId = await fetchChannelIdFromUsername(candidate);

        if (!channelId) {
          console.log(`Cannot resolve channel ID for ${url} in guild ${guild_id}`);
          continue;
        }
      } catch {
        console.log(`Invalid YouTube URL: ${url} in guild ${guild_id}`);
        continue;
      }
    }

    // Fetch latest video
    const latestVideo = await fetchLatestVideo(channelId);

    if (!latestVideo) {
      console.log(`No videos found for channel ${channelId} in guild ${guild_id}`);
      continue;
    }

    // Check last announced video from yt_updates_table
    const { data: lastUpdate, error: lastError } = await supabase
      .from('yt_updates_table')
      .select('last_video_id')
      .eq('guild_id', guild_id)
      .eq('channel_url', url)
      .single();

    if (lastError && lastError.code !== 'PGRST116') {
      console.error('Error fetching last video:', lastError);
      continue;
    }

    if (lastUpdate?.last_video_id === latestVideo.id) {
      // Already announced
      continue;
    }

    // Send update message
    try {
      const guild = await client.guilds.fetch(guild_id);
      const channel = guild.channels.cache.get(setting.updates_channel_id);

      if (!channel || !channel.isTextBased()) {
        console.log(`Update channel invalid for guild ${guild_id}`);
        continue;
      }

      await channel.send(
        `📢 New video uploaded on YouTube:\n**${latestVideo.title}**\nhttps://youtu.be/${latestVideo.id}`
      );

      // Upsert last video info in yt_updates_table
      await supabase
        .from('yt_updates_table')
        .upsert(
          {
            guild_id,
            channel_url: url,
            last_video_id: latestVideo.id,
          },
          { onConflict: ['guild_id', 'channel_url'] }
        );
    } catch (err) {
      console.error(`Failed to send YouTube update message for guild ${guild_id}:`, err);
    }
  }
}
