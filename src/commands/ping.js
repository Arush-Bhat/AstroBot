import { cmdResponseEmbed } from '../utils/embeds.js';

export const permissionLevel = 'Moderator';

export default {
  name: 'ping',
  description: 'Check latency to the Discord server.',

  async execute(client, message, args) {
    const sent = await message.channel.send({ embeds: [cmdResponseEmbed('Calculating latency...')] });
    const messageLatency = sent.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    const embed = cmdResponseEmbed()
      .setTitle('Latency Check')
      .addFields(
        { name: 'Message Latency', value: `${messageLatency}ms`, inline: true },
        { name: 'API Latency', value: `${apiLatency}ms`, inline: true }
      );

    await sent.edit({ content: null, embeds: [embed] });
  },
};
