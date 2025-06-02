// Import the embed utility for consistent styled responses
import { cmdResponseEmbed } from '../utils/embeds.js';

// Set the required permission level for the command
const permissionLevel = 'Moderator';

// Command metadata for help commands or usage descriptions
const data = {
  name: 'ping',
  description: 'Check the bot\'s latency.',
  usage: '$ping',
};

// Main command execution function
async function execute(client, message, args, supabase) {
  console.log('✅ Command ping.js executed with args:', args);

  // Send initial placeholder embed while calculating latency
  const sent = await message.channel.send({
    embeds: [cmdResponseEmbed('🏓 Calculating latency...', 'Latency Check')],
  });

  // Calculate the time difference between the user's message and the bot's reply
  const messageLatency = sent.createdTimestamp - message.createdTimestamp;

  // Get the WebSocket (API) latency from the client
  const apiLatency = Math.round(client.ws.ping);

  // Create the final embed with latency results
  const embed = cmdResponseEmbed('Latency check complete!')
    .setTitle('🏓 Ping | Latency Check')
    .addFields(
      { name: 'Message Latency', value: `${messageLatency}ms`, inline: true },
      { name: 'API Latency', value: `${apiLatency}ms`, inline: true }
    );

  // Edit the placeholder message with the final latency results
  await sent.edit({ content: null, embeds: [embed] });

  // Return log data for command logging middleware or system
  return {
    log: {
      action: 'ping_check',
      executorUserId: message.author.id,
      executorTag: message.author.tag,
      guildId: message.guild.id,
      timestamp: new Date().toISOString(),
      messageLatency,
      apiLatency,
    },
  };
}

// Export the command configuration and logic
export default {
  data,
  permissionLevel,
  execute,
};
