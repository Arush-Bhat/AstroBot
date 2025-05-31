const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'ping',
  description: 'Replies with Pong!',
  async execute(message) {
    const embed = new EmbedBuilder()
      .setTitle('🏓 Pong!')
      .setDescription(`Latency is ${Date.now() - message.createdTimestamp}ms.`)
      .setColor('Green');
    message.channel.send({ embeds: [embed] });
  }
};