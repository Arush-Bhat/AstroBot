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

  // Check if the guild_settings row exists
  let { data: existing, error: fetchError } = await supabase
    .from('guild_settings')
    .select('guild_id')
    .eq('guild_id', guildId)
    .single();

  if (fetchError && fetchError.code === 'PGRST116') {
    // No row found, insert default with $ prefix and admin role
    const { error: insertError } = await supabase
      .from('guild_settings')
      .insert({ guild_id: guildId, prefix: '$', admin_role_id: role.id });

    if (insertError) {
      console.error(insertError);
      return {
        reply: {
          embeds: [
            cmdErrorEmbed(
              'Database Error',
              '❌ Failed to initialize guild settings.\n\nPlease try again later.'
            ),
          ],
        },
      };
    }
  } else if (fetchError) {
    console.error(fetchError);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Database Error',
            '❌ Failed to fetch guild settings.\n\nPlease try again later.'
          ),
        ],
      },
    };
  } else {
    // Row exists, update admin_role_id
    const { error: updateError } = await supabase
      .from('guild_settings')
      .update({ admin_role_id: role.id })
      .eq('guild_id', guildId);

    if (updateError) {
      console.error(updateError);
      return {
        reply: {
          embeds: [
            cmdErrorEmbed(
              'Database Error',
              '❌ Failed to update the admin role in the database.\n\nPlease try again later.'
            ),
          ],
        },
      };
    }
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
