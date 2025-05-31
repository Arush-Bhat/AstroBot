import supabase from '../supabaseClient.js';
import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Admin';

const data = {
  name: 'setmod',
  description: 'Set the moderator role for this server. Admin-only.',
  usage: '$setmod @role',
};

async function execute(client, message, args, supabase) {
  const guildId = message.guild.id;

  // Check if user has administrator permission
  if (!message.member.permissions.has('Administrator')) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed('❌ Permission Denied', 'You need Administrator permission to set the mod role.'),
        ],
      },
    };
  }

  const role = message.mentions.roles.first();
  if (!role) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed('❌ Invalid Role', 'Please mention a valid role. Usage: `$setmod @role`'),
        ],
      },
    };
  }

  // Save role to Supabase
  const { error } = await supabase
    .from('guild_settings')
    .upsert({ guild_id: guildId, mod_role_id: role.id })
    .eq('guild_id', guildId);

  if (error) {
    console.error(error);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed('❌ Database Error', 'Failed to save the mod role. Please try again later.'),
        ],
      },
    };
  }

  return {
    reply: {
      embeds: [
        cmdResponseEmbed('✅ Moderator Role Set', `Moderator role has been set to ${role}.`, 'Green'),
      ],
    },
    log: {
      action: 'setModRole',
      roleId: role.id,
      roleName: role.name,
      moderatorId: message.author.id,
      moderatorTag: message.author.tag,
      guildId,
      timestamp: new Date().toISOString(),
    },
  };
}

export default {
  data,
  permissionLevel,
  execute,
};