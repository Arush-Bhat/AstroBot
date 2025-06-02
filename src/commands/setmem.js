import supabase from '../supabaseClient.js';
import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

// Only users with Admin-level permission can use this command
const permissionLevel = 'Admin';

const data = {
  name: 'setmem',
  description: 'Set the member role for this server. Admin-only.',
  usage: '$setmem @role',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command setmem.js executed with args:', args);
  const guildId = message.guild.id;

  // Check if the user has Administrator permission
  if (!message.member.permissions.has('Administrator')) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Permission Denied',
            '❌ You need **Administrator** permission to use this command.\n\n' +
            'Only server admins can assign a member role using `$setmem @role`.'
          ),
        ],
      },
    };
  }

  // Attempt to get the mentioned role from the message
  const role = message.mentions.roles.first();
  if (!role) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Role Mention',
            '❌ Please mention a valid role to set as the member role.\n\n' +
            'Correct usage: `$setmem @role`'
          ),
        ],
      },
    };
  }

  // Save or update the member role ID in the 'guild_settings' table
  const { error } = await supabase
    .from('guild_settings')
    .upsert({ guild_id: guildId, member_role_id: role.id }) // Upsert ensures insert or update
    .eq('guild_id', guildId); // Ensure it's for the correct guild

  // Handle potential database error
  if (error) {
    console.error('❌ Supabase error:', error);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Database Error',
            '❌ Failed to save the member role in the database.\n\n' +
            'Please try again later or contact a developer if the problem persists.'
          ),
        ],
      },
    };
  }

  // Respond with confirmation embed and log the action
  return {
    reply: {
      embeds: [
        cmdResponseEmbed(
          'Member Role Set',
          `✅ Member role has been set to ${role}.`
        ),
      ],
    },
    log: {
      action: 'setMemberRole',
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
