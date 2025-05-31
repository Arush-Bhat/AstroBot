const { EmbedBuilder } = require('discord.js');
const supabase = require('../supabaseClient');
const { isModerator } = require('../utils/permissions');

module.exports = {
  name: 'yt',
  async execute(message, args) {
    if (!await isModerator(message.member)) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor('Red')
          .setTitle('Unauthorized')
          .setDescription('Only moderators can use this command.')],
      });
    }

    if (!args.length) {
      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor('Red')
          .setTitle('Usage')
          .setDescription('Use:\n• `$yt #channel` to set the updates channel\n• `$yt <YouTube URL>` to subscribe to a YouTube channel')],
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
          updates_channel_id: channelMention.id
        }, { onConflict: ['guild_id'] });

      if (error) {
        console.error(error);
        return message.reply('Failed to set updates channel.');
      }

      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor('Green')
          .setTitle('YouTube Updates Channel Set')
          .setDescription(`Updates will be posted in ${channelMention}`)],
      });
    }

    // Register YouTube channel
    if (ytUrlPattern.test(args[0])) {
      const { data: ytSetting } = await supabase
        .from('yt_settings')
        .select('updates_channel_id')
        .eq('guild_id', message.guild.id)
        .single();

      if (!ytSetting || !ytSetting.updates_channel_id) {
        return message.reply({
          embeds: [new EmbedBuilder()
            .setColor('Red')
            .setTitle('Missing Update Channel')
            .setDescription('Please set an updates channel first using `$yt #channel`')],
        });
      }

      const url = args[0];

      const { error } = await supabase
        .from('yt_channels')
        .upsert({
          guild_id: message.guild.id,
          url: url
        }, { onConflict: ['guild_id'] });

      if (error) {
        console.error(error);
        return message.reply('Failed to save YouTube channel.');
      }

      return message.reply({
        embeds: [new EmbedBuilder()
          .setColor('Green')
          .setTitle('YouTube Channel Subscribed')
          .setDescription(`Now tracking: ${url}`)],
      });
    }

    return message.reply({
      embeds: [new EmbedBuilder()
        .setColor('Red')
        .setTitle('Invalid Argument')
        .setDescription('Please provide either a YouTube channel URL or tag a text channel.')],
    });
  }
};
