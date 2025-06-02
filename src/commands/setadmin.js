import supabase from '../supabaseClient.js';
import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

// This command requires the user to be an Admin
const permissionLevel = 'Admin';

const data = {
  name: 'setadmin',
  description: 'Sets the Administrator role for the server.',
  usage: '$setadmin @role',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command setadmin.js executed with args:', args);
  const member = message.member;

  // Check if the user has Administrator permissions
  if (!member.permissions.has('Administrator')) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Permission Denied',
            '❌ You need the **Administrator** permission to use this command.\n\n' +
            'Only server admins can configure roles.'
          )
        ],
      },
    };
  }

  // Validate that a role was mentioned
  const role = message.mentions.roles.first();
  if (!role) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Role',
            '❌ Please mention a **valid role** to set as the Administrator role.\n\n' +
            'Example: `$setadmin @AdminRole`'
          )
        ],
      },
    };
  }

  const guildId = message.guild.id;

  // Save the admin role ID to Supabase for this guild
  const { error } = await supabase
    .from('guild_settings')
    .upsert({ guild_id: guildId, admin_role_id: role.id }) // Insert or update the admin role
    .eq('guild_id', guildId); // Ensure update is scoped to the current guild

  // Handle any Supabase errors
  if (error) {
    console.error(error);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Database Error',
            '❌ Failed to save the admin role to the database.\n\n' +
            'Please try again later or contact a bot developer.'
          )
        ],
      },
    };
  }

  // Send a confirmation message and log the change
  return {
    reply: {
      embeds: [
        cmdResponseEmbed(
          'Administrator Role Set',
          `✅ Administrator role has been set to ${role.toString()}.`
        ),
      ],
    },
    log: {
      action: 'set_admin_role',
      executorUserId: message.author.id,
      executorTag: message.author.tag,
      guildId,
      roleId: role.id,
      roleName: role.name,
      timestamp: new Date().toISOString(),
    },
  };
}

export default {
  data,
  permissionLevel,
  execute,
};
