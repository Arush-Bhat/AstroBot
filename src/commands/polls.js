import { EmbedBuilder } from 'discord.js';
import { isModerator } from '../utils/permissions.js';

const permissionLevel = 'Mod';

const data = {
  name: 'polls',
  description: 'Create or conclude polls using advanced syntax.',
  usage:
    '$polls #channel msg("Poll question") options((emoji:"Text"), ...) config(multiple=true/false)\n' +
    '$polls #channel msgId("message_id") conclude',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command modch.js executed with args:', args);
  const guildId = message.guild.id;
  const authorId = message.author.id;

  if (!(await isModerator(message.member))) {
    return {
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Permission Denied')
            .setDescription('You must be a moderator to use this command.'),
        ],
      },
    };
  }

  // Utility parsing
  function parseParenArg(str, key) {
    const regex = new RegExp(`${key}\\("([^"]+)"\\)`);
    const match = str.match(regex);
    return match ? match[1] : null;
  }

  function parseOptions(str) {
    const regex = /(?:\(([^:]+):"([^"]+)"\))/g;
    const options = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
      options.push({ emoji: match[1].trim(), text: match[2].trim() });
    }
    return options;
  }

  function parseConfig(str) {
    const regex = /config\(multiple=(true|false)\)/;
    const match = str.match(regex);
    return { multiple: match ? match[1] === 'true' : true };
  }

  // 🛑 Conclude Poll
  if (args.length >= 3 && args[2].toLowerCase() === 'conclude') {
    const channelMention = args[0];
    const messageId = parseParenArg(args[1], 'msgId');

    if (!messageId) {
      return {
        reply: {
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('❌ Invalid Syntax')
              .setDescription('Missing or malformed `msgId`.\n\nExample: `msgId("123456789012345678")`'),
          ],
        },
      };
    }

    const channelId = channelMention.replace(/[<#>]/g, '');
    const channel = await message.guild.channels.fetch(channelId).catch(() => null);

    if (!channel) {
      return {
        reply: {
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('❌ Invalid Channel')
              .setDescription('Make sure you mention a valid channel. Example: `#polls`'),
          ],
        },
      };
    }

    const { data, error } = await supabase
      .from('polls')
      .select('*')
      .eq('guild_id', guildId)
      .eq('message_id', messageId)
      .single();

    if (error || !data) {
      return {
        reply: {
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('❌ Poll Not Found')
              .setDescription('No active poll found with the provided message ID.'),
          ],
        },
      };
    }

    try {
      const pollMessage = await channel.messages.fetch(data.message_id);
      const reactions = pollMessage.reactions.cache;
      const results = [];

      for (const [emoji, reaction] of reactions) {
        const count = (await reaction.users.fetch()).filter((u) => !u.bot).size;
        results.push({ emoji, count });
      }

      const sorted = results.sort((a, b) => b.count - a.count);
      const stats = sorted.map((r) => `${r.emoji}: ${r.count}`).join('\n') || 'No votes received.';

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
        reply: {
          embeds: [
            new EmbedBuilder()
              .setColor('Green')
              .setTitle('✅ Poll Concluded')
              .setDescription('Results posted and poll deleted.'),
          ],
        },
        log: {
          action: 'concludePoll',
          pollTitle: data.title,
          channelId: channel.id,
          messageId,
          concludedBy: authorId,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err) {
      console.error('Error concluding poll:', err);
      return {
        reply: {
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('❌ Unexpected Error')
              .setDescription('An error occurred while concluding the poll. Check my permissions and try again.'),
          ],
        },
      };
    }
  }

  // ✅ Create Poll
  if (args.length < 3) {
    return {
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Invalid Syntax')
            .setDescription(
              'You must provide at least a channel, question, and two options.\n\n' +
              '**Example:**\n' +
              '`$polls #polls msg("Your question?") options((👍:"Yes"), (👎:"No")) config(multiple=false)`'
            ),
        ],
      },
    };
  }

  const channelMention = args[0];
  const channelId = channelMention.replace(/[<#>]/g, '');
  const channel = await message.guild.channels.fetch(channelId).catch(() => null);

  if (!channel) {
    return {
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Invalid Channel')
            .setDescription('Could not resolve the mentioned channel. Please use `#channel`.'),
        ],
      },
    };
  }

  const argsStr = args.slice(1).join(' ');
  const pollQuestion = parseParenArg(argsStr, 'msg');
  const options = parseOptions(argsStr);
  const config = parseConfig(argsStr);
  const isMulti = config.multiple ?? true;

  if (!pollQuestion) {
    return {
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Missing Question')
            .setDescription('Use `msg("Your poll question")` to provide a question.'),
        ],
      },
    };
  }

  if (options.length < 2) {
    return {
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Too Few Options')
            .setDescription('You must include **at least two options**.\n\nExample:\n`options((👍:"Yes"), (👎:"No"))`'),
        ],
      },
    };
  }

  const embed = new EmbedBuilder()
    .setTitle('🗳️ New Poll')
    .setDescription(pollQuestion)
    .addFields(options.map((opt) => ({ name: opt.emoji, value: opt.text, inline: true })))
    .setFooter({ text: isMulti ? 'Users can vote for multiple options.' : 'Users can vote only once.' })
    .setColor('Green');

  const pollMessage = await channel.send({ embeds: [embed] });

  for (const { emoji } of options) {
    try {
      await pollMessage.react(emoji);
    } catch (err) {
      console.error(`Failed to react with emoji ${emoji}`, err);
    }
  }

  await supabase.from('polls').insert({
    guild_id: guildId,
    channel_id: channel.id,
    message_id: pollMessage.id,
    title: pollQuestion,
    options,
    is_multi: isMulti,
    created_at: new Date().toISOString(),
  });

  return {
    reply: { content: '✅ Poll created successfully!' },
    log: {
      action: 'createPoll',
      pollTitle: pollQuestion,
      channelId: channel.id,
      messageId: pollMessage.id,
      options,
      isMulti,
      createdBy: authorId,
      timestamp: new Date().toISOString(),
    },
  };
}

export default {
  data,
  permissionLevel,
  execute,
};
