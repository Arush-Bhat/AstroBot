import supabase from '../supabaseClient.js';
import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

// Only users with Admin permission can use this command
const permissionLevel = 'Admin';

const data = {
  name: 'setmod',
  description: 'Set the moderator role for this server. Admin-only.',
  usage: '$setmod @role',
};

async function execute(client, message, args) { // ❌ removed `supabase` here
  console.log('✅ Command setmod.js executed with args:', args);
  const guildId = message.guild.id;

  // Check if user has Administrator permission
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

  // Get the first mentioned role in the message
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

  // Check if guild_settings row exists
  let { data: existing, error: fetchError } = await supabase
    .from('guild_settings')
    .select('guild_id')
    .eq('guild_id', guildId)
    .single();

  if (fetchError && fetchError.code === 'PGRST116') {
    // No row found, insert default with $ prefix and mod_role_id
    const { error: insertError } = await supabase
      .from('guild_settings')
      .insert({ guild_id: guildId, prefix: '$', mod_role_id: role.id });

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
    // Row exists, update mod_role_id
    const { error: updateError } = await supabase
      .from('guild_settings')
      .update({ mod_role_id: role.id })
      .eq('guild_id', guildId);

    if (updateError) {
      console.error(updateError);
      return {
        reply: {
          embeds: [
            cmdErrorEmbed(
              'Database Error',
              '❌ Failed to update the moderator role in the database.\n\nPlease try again later.'
            ),
          ],
        },
      };
    }
  }

  // Respond with a success embed and include logging metadata
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
