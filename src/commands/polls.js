const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const supabase = require('../supabaseClient');
const { isModerator } = require('../utils/permissions');

module.exports = {
  name: 'poll',
  async execute(message, args) {
    const guildId = message.guild.id;
    const authorId = message.author.id;

    if (!await isModerator(message.member)) {
      return message.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription("❌ You don't have permission to use this command.")] });
    }

    // Conclude command
    if (args.length === 2 && args[1] === 'conclude') {
      const messageId = args[0];
      const { data, error } = await supabase
        .from('polls')
        .select('*')
        .eq('guild_id', guildId)
        .eq('message_id', messageId)
        .single();

      if (error || !data) {
        return message.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ No such poll found.')] });
      }

      try {
        const channel = await message.guild.channels.fetch(data.channel_id);
        const pollMessage = await channel.messages.fetch(data.message_id);

        const reactions = pollMessage.reactions.cache;
        const results = [];

        for (const [emoji, reaction] of reactions) {
          const count = (await reaction.users.fetch()).filter(u => !u.bot).size;
          results.push({ emoji, count });
        }

        const sorted = results.sort((a, b) => b.count - a.count);
        const stats = sorted.map(r => `${r.emoji}: ${r.count}`).join('\n');

        const resultEmbed = new EmbedBuilder()
          .setTitle('📊 Poll Results')
          .setDescription(data.title)
          .addFields({ name: 'Results', value: stats || 'No votes' })
          .setFooter({ text: `Poll started at: ${new Date(data.created_at).toLocaleString()}` })
          .setColor('Blue');

        await pollMessage.delete();
        await channel.send({ embeds: [resultEmbed] });
        await supabase.from('polls').delete().eq('message_id', messageId);
      } catch (err) {
        console.error('Error concluding poll:', err);
      }

      return;
    }

    // Create poll
    const channel = message.mentions.channels.first();
    if (!channel) {
      return message.reply({ embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Please mention a channel.')] });
    }

    // Simple text-based setup (can later replace with modal/buttons)
    const filter = m => m.author.id === message.author.id;

    message.channel.send('📝 Enter the poll question (you have 60s):');
    const collectedQuestion = await message.channel.awaitMessages({ filter, max: 1, time: 60000 });
    if (!collectedQuestion.size) return message.channel.send('⏱️ Time expired.');

    const title = collectedQuestion.first().content;

    message.channel.send('🔢 Enter options in the format:\n`emoji Option text` (one per line, max 16). Type `done` when finished.');
    const collectedOptions = [];
    while (collectedOptions.length < 16) {
      const collected = await message.channel.awaitMessages({ filter, max: 1, time: 60000 });
      if (!collected.size) return message.channel.send('⏱️ Time expired.');
      const content = collected.first().content;
      if (content.toLowerCase() === 'done') break;

      const match = content.match(/^(\S+)\s+(.+)$/);
      if (!match) {
        message.channel.send('❌ Format must be `emoji Option text`. Try again.');
        continue;
      }

      const [_, emoji, text] = match;
      collectedOptions.push({ emoji, text });
    }

    if (collectedOptions.length < 2) {
      return message.channel.send('❌ You must enter at least 2 options.');
    }

    // Ask if multiselect
    message.channel.send('✅ Should the poll allow multiple choices? (yes/no)');
    const multiMsg = await message.channel.awaitMessages({ filter, max: 1, time: 30000 });
    const isMulti = multiMsg.first()?.content.toLowerCase().startsWith('y') ?? true;

    // Create embed and message
    const embed = new EmbedBuilder()
      .setTitle('🗳️ New Poll')
      .setDescription(title)
      .addFields(collectedOptions.map(opt => ({ name: opt.emoji, value: opt.text, inline: true })))
      .setFooter({ text: isMulti ? 'Users can vote for multiple options.' : 'Users can vote only once.' })
      .setColor('Green');

    const pollMessage = await channel.send({ embeds: [embed] });

    for (const { emoji } of collectedOptions) {
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
      title,
      options: collectedOptions,
      is_multi: isMulti,
    });

    message.channel.send('✅ Poll created successfully!');
  },
};
