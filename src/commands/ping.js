import { cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Moderator';

const data = {
  name: 'ping',
  description: 'Check the bot\'s latency.',
  usage: '$ping',
};

async function execute(client, message, args, supabase) {
  // Send initial embed while calculating
  const sent = await message.channel.send({
    embeds: [cmdResponseEmbed('🏓 Calculating latency...')],
  });

  const messageLatency = sent.createdTimestamp - message.createdTimestamp;
  const apiLatency = Math.round(client.ws.ping);

  const embed = cmdResponseEmbed('Latency check complete!')
    .setTitle('🏓 Ping | Latency Check')
    .addFields(
      { name: 'Message Latency', value: `${messageLatency}ms`, inline: true },
      { name: 'API Latency', value: `${apiLatency}ms`, inline: true }
    );

  await sent.edit({ content: null, embeds: [embed] });
}

export default {
  data,
  permissionLevel,
  execute,
};
