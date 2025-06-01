import { cmdResponseEmbed, cmdErrorEmbed } from '../utils/embeds.js';

const permissionLevel = 'Moderator';

const data = {
  name: 'setprefix',
  description: 'Change the command prefix for this server.',
  usage: '$setprefix <newPrefix>',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command setprefix.js executed with args:', args);
  const newPrefix = args[0];

  if (!newPrefix) {
    return await cmdErrorEmbed(message, 'Please provide a new prefix. Example: `$setprefix !`');
  }

  if (newPrefix.length > 5) {
    return await cmdErrorEmbed(message, 'The prefix must be 5 characters or fewer.');
  }

  const { error } = await supabase
    .from('guild_settings')
    .update({ prefix: newPrefix })
    .eq('guild_id', message.guild.id);

  if (error) {
    console.error('Failed to update prefix:', error);
    return await cmdErrorEmbed(message, 'An error occurred while updating the prefix.');
  }

  const embed = cmdResponseEmbed(`✅ Prefix updated to \`${newPrefix}\` for this server.`)
    .setTitle('🔧 Prefix Updated');

  await message.channel.send({ embeds: [embed] });
}

export default {
  data,
  permissionLevel,
  execute,
};
