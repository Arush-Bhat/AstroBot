import { EmbedBuilder } from 'discord.js';
import supabase from './src/supabaseClient.js';
import { isModerator } from '../utils/permissions.js';

export const permissionLevel = 'Mod';

export default {
  name: 'polls',
  description: 'Create or conclude polls using advanced syntax.',
  usage: '$polls #channel msg("Poll question") options((emoji:"Text"), ...) config(multiple=true/false)\n$polls #channel msgId("message_id") conclude',
  
  async execute(message, args) {
    const guildId = message.guild.id;
    const authorId = message.author.id;

    if (!await isModerator(message.member)) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription("❌ You don't have permission to use this command."),
        ],
      });
    }

    // Helper to parse quoted content inside parentheses, e.g. msg("text")
    function parseParenArg(str, key) {
      const regex = new RegExp(`${key}\\("([^"]+)"\\)`);
      const match = str.match(regex);
      return match ? match[1] : null;
    }

    // Helper to parse options((emoji:"Text"), (emoji:"Text"))
    function parseOptions(str) {
      const regex = /(?:\(([^:]+):"([^"]+)"\))/g;
      const options = [];
      let match;
      while ((match = regex.exec(str)) !== null) {
        options.push({ emoji: match[1].trim(), text: match[2].trim() });
      }
      return options;
    }

    // Helper to parse config(multiple=true/false)
    function parseConfig(str) {
      const regex = /config\(multiple=(true|false)\)/;
      const match = str.match(regex);
      if (!match) return { multiple: true };
      return { multiple: match[1] === 'true' };
    }

    // Check if concluding poll: $polls #channel msgId("message_id") conclude
    if (args.length >= 3 && args[2].toLowerCase() === 'conclude') {
      const channelMention = args[0];
      const msgIdArg = args[1];

      // Extract message ID from msgId("...")
      const messageId = parseParenArg(msgIdArg, 'msgId');
      if (!messageId) {
        return message.reply({
          embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Invalid msgId format. Use msgId("message_id")')],
        });
      }

      // Get channel from mention
      const channelId = channelMention.replace(/[<#>]/g, '');
      const channel = await message.guild.channels.fetch(channelId).catch(() => null);

      if (!channel) {
        return message.reply({
          embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Invalid channel mention.')],
        });
      }

      // Fetch poll from DB
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .eq('guild_id', guildId)
        .eq('message_id', messageId)
        .single();

      if (error || !data) {
        return message.reply({
          embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ No such poll found.')],
        });
      }

      try {
        const pollMessage = await channel.messages.fetch(data.message_id);
        const reactions = pollMessage.reactions.cache;
        const results = [];

        for (const [emoji, reaction] of reactions) {
          const count = (await reaction.users.fetch()).filter(u => !u.bot).size;
          results.push({ emoji, count });
        }

        const sorted = results.sort((a, b) => b.count - a.count);
        const stats = sorted.map(r => `${r.emoji}: ${r.count}`).join('\n') || 'No votes';

        const resultEmbed = new EmbedBuilder()
          .setTitle('📊 Poll Results')
          .setDescription(data.title)
          .addFields({ name: 'Results', value: stats })
          .setFooter({ text: `Poll started at: ${new Date(data.created_at).toLocaleString()}` })
          .setColor('Blue');

        await pollMessage.delete();
        await channel.send({ embeds: [resultEmbed] });
        await supabase.from('polls').delete().eq('message_id', messageId);

        return {
          action: 'concludePoll',
          pollTitle: data.title,
          channelId: channel.id,
          messageId: messageId,
          concludedBy: authorId,
        };
      } catch (err) {
        console.error('Error concluding poll:', err);
        return message.reply({
          embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Error concluding poll.')],
        });
      }
    }

    // Otherwise, creating a poll:
    // Syntax example:
    // $polls #channel msg("Question?") options((👍:"Yes"), (👎:"No")) config(multiple=false)
    if (args.length < 3) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setDescription('❌ Invalid command syntax.'),
        ],
      });
    }

    // Parse channel mention
    const channelMention = args[0];
    const channelId = channelMention.replace(/[<#>]/g, '');
    const channel = await message.guild.channels.fetch(channelId).catch(() => null);
    if (!channel) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Invalid channel mention.')],
      });
    }

    // Join the rest of the args into a single string to parse msg(), options(), config()
    const argsStr = args.slice(1).join(' ');

    // Parse poll question
    const pollQuestion = parseParenArg(argsStr, 'msg');
    if (!pollQuestion) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Missing or invalid poll question. Use msg("Your question")')],
      });
    }

    // Parse options
    const options = parseOptions(argsStr);
    if (options.length < 2) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ You must specify at least 2 options.')],
      });
    }

    // Parse config
    const config = parseConfig(argsStr);
    const isMulti = config.multiple ?? true;

    // Create poll embed
    const embed = new EmbedBuilder()
      .setTitle('🗳️ New Poll')
      .setDescription(pollQuestion)
      .addFields(options.map(opt => ({ name: opt.emoji, value: opt.text, inline: true })))
      .setFooter({ text: isMulti ? 'Users can vote for multiple options.' : 'Users can vote only once.' })
      .setColor('Green');

    // Send poll message
    const pollMessage = await channel.send({ embeds: [embed] });

    // React with emojis
    for (const { emoji } of options) {
      try {
        await pollMessage.react(emoji);
      } catch (err) {
        console.error('Failed to react with', emoji, err);
      }
    }

    // Save to Supabase
    await supabase.from('polls').insert({
      guild_id: guildId,
      channel_id: channel.id,
      message_id: pollMessage.id,
      title: pollQuestion,
      options,
      is_multi: isMulti,
    });

    message.channel.send('✅ Poll created successfully!');

    return {
      action: 'createPoll',
      pollTitle: pollQuestion,
      channelId: channel.id,
      messageId: pollMessage.id,
      options,
      isMulti,
      createdBy: authorId,
    };
  },
};
