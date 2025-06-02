import { EmbedBuilder } from 'discord.js';
import supabase from '../supabaseClient.js';
import { isModerator } from '../utils/permissions.js';

const permissionLevel = 'Mod';

const data = {
  name: 'polls',
  description: 'Create or conclude polls using advanced syntax.',
  usage:
    '$polls #channel msg("Poll question") options((emoji:"Text"), ...) config(multiple=true/false)\n' +
    '$polls message_id conclude',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command polls.js executed with args:', args);

  // Fetch mod/admin role IDs from the database
  const { data: guild_settings, error: guildError } = await supabase
    .from('guild_settings')
    .select('mod_role_id, admin_role_id')
    .eq('guild_id', message.guild.id)
    .single();

  if (guildError || !guild_settings) {
    return {
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Error finding database')
            .setDescription('Please contact a developer regarding this issue.'),
        ],
      },
    };
  }

  // Check if user has mod or admin privileges
  if (!isModerator(message.member, guild_settings.mod_role_id, guild_settings.admin_role_id)) {
    return {
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Permission Denied')
            .setDescription('You need mod or admin privileges to use this command.'),
        ],
      },
    };
  }

  // === Utility Functions ===

  // Extracts value from syntax like: key("value")
  function parseParenArg(str, key) {
    const regex = new RegExp(`${key}\\("([^"]+)"\\)`);
    const match = str.match(regex);
    return match ? match[1] : null;
  }

  // Parses options from format like: options((emoji:"text"), ...)
  function parseOptions(str) {
    const regex = /\(\s*([^:()]+)\s*:\s*"([^"]+)"\s*\)/g;
    const options = [];
    let match;
    while ((match = regex.exec(str)) !== null) {
      options.push({ emoji: match[1].trim(), text: match[2].trim() });
    }
    return options;
  }

  // Parses poll config from syntax like: config(multiple=true)
  function parseConfig(str) {
    const regex = /config\(multiple=(true|false)\)/;
    const match = str.match(regex);
    return { multiple: match ? match[1] === 'true' : true };
  }

  // === CONCLUDE POLL ===
  const isConclude = args[1]?.toLowerCase?.() === 'conclude';
  if (isConclude && /^\d{17,20}$/.test(args[0])) {
    const messageId = args[0];

    // Fetch poll from database
    const { data: pollData, error: pollError } = await supabase
      .from('polls')
      .select('*')
      .eq('guild_id', message.guild.id)
      .eq('message_id', messageId)
      .single();

    if (pollError || !pollData) {
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

    // Fetch the channel where the poll was created
    const channel = await message.guild.channels.fetch(pollData.channel_id).catch(() => null);

    if (!channel || !channel.isTextBased()) {
      return {
        reply: {
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('❌ Invalid Channel')
              .setDescription('Could not find the channel where the poll was created.'),
          ],
        },
      };
    }

    try {
      const pollMessage = await channel.messages.fetch(pollData.message_id);
      const reactions = pollMessage.reactions.cache;
      const results = [];

      // Count votes (excluding bot reactions)
      for (const [emoji, reaction] of reactions) {
        const count = (await reaction.users.fetch()).filter((u) => !u.bot).size;
        results.push({ emoji, count });
      }

      // Sort and format results
      const sorted = results.sort((a, b) => b.count - a.count);
      const stats = sorted.map((r) => `${r.emoji}: ${r.count}`).join('\n') || 'No votes received.';

      // Format timestamp safely
      const createdAt = pollData.created_at ? new Date(pollData.created_at) : new Date();

      // Create and send results embed
      const resultEmbed = new EmbedBuilder()
        .setTitle('📊 Poll Results')
        .setDescription(pollData.texts.question)
        .addFields({ name: 'Results', value: stats })
        .setFooter({ text: `Poll started at: ${createdAt.toLocaleString()}` })
        .setColor('Blue');

      await pollMessage.delete(); // Delete original poll message
      await channel.send({ embeds: [resultEmbed] }); // Post results
      await supabase.from('polls').delete().eq('message_id', messageId); // Remove from DB

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
          pollTitle: pollData.texts.question,
          channelId: channel.id,
          messageId,
          concludedBy: message.author.id,
          reason: `Poll message deleted by ${message.author.tag} using $polls ${messageId} conclude.`,
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

  // === CREATE POLL ===

  // Require at least channel, question, and 2 options
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

  // Resolve channel from mention
  const channelMention = args[0];
  const channelId = channelMention.replace(/[<#>]/g, '');
  const channel = await message.guild.channels.fetch(channelId).catch(() => null);

  if (!channel || !channel.isTextBased()) {
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

  // Parse poll arguments
  const argsStr = args.slice(1).join(' ');
  const pollQuestion = parseParenArg(argsStr, 'msg');
  const options = parseOptions(argsStr);
  const config = parseConfig(argsStr);
  const isMulti = config.multiple ?? true;

  // Ensure question exists
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

  // Require at least 2 poll options
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

  // Build and send poll embed
  const embed = new EmbedBuilder()
    .setTitle('🗳️ New Poll')
    .setDescription(pollQuestion)
    .addFields(options.map((opt) => ({ name: opt.emoji, value: opt.text, inline: true })))
    .setFooter({ text: isMulti ? 'Users can vote for multiple options.' : 'Users can vote only once.' })
    .setColor('Green');

  const pollMessage = await channel.send({ embeds: [embed] });

  // React with each emoji option
  for (const { emoji } of options) {
    try {
      await pollMessage.react(emoji);
    } catch (err) {
      console.error(`Failed to react with emoji ${emoji}`, err);
    }
  }

  // Save poll in database
  await supabase.from('polls').insert({
    guild_id: message.guild.id,
    channel_id: channel.id,
    message_id: pollMessage.id,
    texts: {
      question: pollQuestion,
      options: options.map((opt) => ({ emoji: opt.emoji, text: opt.text })),
    },
    multiple: isMulti,
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
      createdBy: message.author.id,
      reason: `Poll message created by ${message.author.tag} in #${channel.name}.`,
      timestamp: new Date().toISOString(),
    },
  };
}

export default {
  data,
  permissionLevel,
  execute,
};
