import supabase from '../supabaseClient.js';
import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embedHelpers.js';

const permissionLevel = 'Admin';

const data = {
  name: 'setmod',
  description: 'Set the moderator role',
};

async function execute(message, args) {
  if (!message.member.permissions.has('Administrator')) {
    return message.channel.send({
      embeds: [cmdErrorEmbed('❌ Permission Denied', 'You need Administrator permission to set the mod role.')]
    });
  }

  const role = message.mentions.roles.first();
  if (!role) {
    return message.channel.send({
      embeds: [cmdErrorEmbed('❌ Invalid Role', 'Please mention a valid role. Usage: `$setmod @role`')]
    });
  }

  const guildId = message.guild.id;

  const { error } = await supabase
    .from('guild_settings')
    .upsert({ guild_id: guildId, mod_role_id: role.id })
    .eq('guild_id', guildId);

  if (error) {
    console.error(error);
    return message.channel.send({
      embeds: [cmdErrorEmbed('❌ Database Error', 'Failed to save the mod role. Please try again later.')]
    });
  }

  message.channel.send({
    embeds: [cmdResponseEmbed('✅ Moderator Role Set', `Moderator role has been set to ${role.name}.`)]
  });

  return {
    action: 'setModRole',
    roleId: role.id,
    roleName: role.name,
    moderatorId: message.author.id,
    moderatorTag: message.author.tag,
  };
};

export default {
  permissionLevel,
  data,
  execute,
};
