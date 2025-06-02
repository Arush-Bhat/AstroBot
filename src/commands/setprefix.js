import { cmdResponseEmbed, cmdErrorEmbed } from '../utils/embeds.js';

const permissionLevel = 'Moderator';  // Required permission level to run this command

const data = {
  name: 'setprefix',  // Command name
  description: 'Change the command prefix for this server.',  // Command description shown in help
  usage: '$setprefix <newPrefix>',  // Usage example for the command
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command setprefix.js executed with args:', args);
  const newPrefix = args[0];  // Get the new prefix from command arguments

  // Check if a new prefix was provided
  if (!newPrefix) {
    return await cmdErrorEmbed(message, 'Please provide a new prefix. Example: `$setprefix !`');
  }

  // Validate prefix length (max 5 characters)
  if (newPrefix.length > 5) {
    return await cmdErrorEmbed(message, 'The prefix must be 5 characters or fewer.');
  }

  // Update the prefix in the Supabase 'guild_settings' table for the current guild
  const { error } = await supabase
    .from('guild_settings')
    .update({ prefix: newPrefix })
    .eq('guild_id', message.guild.id);

  // Handle potential database errors
  if (error) {
    console.error('Failed to update prefix:', error);
    return await cmdErrorEmbed(message, 'An error occurred while updating the prefix.');
  }

  // Create a confirmation embed message
  const embed = cmdResponseEmbed(`✅ Prefix updated to \`${newPrefix}\` for this server.`)
    .setTitle('🔧 Prefix Updated');

  // Send the confirmation embed to the channel
  await message.channel.send({ embeds: [embed] });
  
  // Return an object to log this action elsewhere if needed
  return {
    log: {
        action: 'prefix_updated',
        executorUserId: message.author.id,
        executorTag: message.author.tag,
        guildId: message.guild.id,
        newPrefix: newPrefix,
        reason: `Command prefix changed to "${newPrefix}" by ${message.author.tag}`,
        timestamp: new Date().toISOString(),
    },
  };
}

export default {
  data,
  permissionLevel,
  execute,
};
