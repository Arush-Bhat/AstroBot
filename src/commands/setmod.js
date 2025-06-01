import supabase from '../supabaseClient.js';
import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Admin';

const data = {
  name: 'setmod',
  description: 'Set the moderator role for this server. Admin-only.',
  usage: '$setmod @role',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command setmod.js executed with args:', args);
  const guildId = message.guild.id;

  // Check if user has administrator permission
  if (!message.member.permissions.has('Administrator')) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Permission Denied',
            '❌ You need **Administrator** permission to use this command.\n\n' +
            'Only server admins can assign a mod role using `$setmod @role`.'
          ),
        ],
      },
    };
  }

  const role = message.mentions.roles.first();
  if (!role) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Role Mention',
            '❌ Please mention a valid role to set as the moderator role.\n\n' +
            'Correct usage: `$setmod @role`'
          ),
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
          cmdErrorEmbed(
            'Database Error',
            '❌ Failed to save the moderator role in the database.\n\n' +
            'Please try again later or contact a developer if the problem persists.'
          ),
        ],
      },
    };
  }

  return {
    reply: {
      embeds: [
        cmdResponseEmbed(
          'Moderator Role Set',
          `✅ Moderator role has been set to ${role}.`
        ),
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
