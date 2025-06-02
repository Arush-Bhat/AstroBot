import supabase from '../supabaseClient.js';
import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Admin';

const data = {
  name: 'setvis',
  description: 'Set the visitor role for this server. Admin-only.',
  usage: '$setvis @role',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command setvis.js executed with args:', args);
  const guildId = message.guild.id;

  // Check if user has administrator permission
  if (!message.member.permissions.has('Administrator')) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Permission Denied',
            '❌ You need **Administrator** permission to use this command.\n\n' +
            'Only server admins can assign a visitor role using `$setvis @role`.'
          ),
        ],
      },
    };
  }

  // Get the first mentioned role from the message
  const role = message.mentions.roles.first();
  if (!role) {
    // If no role was mentioned, send an error embed with usage instructions
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Role Mention',
            '❌ Please mention a valid role to set as the visitor role.\n\n' +
            'Correct usage: `$setvis @role`'
          ),
        ],
      },
    };
  }

  // Save or update the visitor role for this guild in the 'guild_settings' table
  // Use upsert to insert or update based on guild_id
  const { error } = await supabase
    .from('guild_settings')
    .upsert({ guild_id: guildId, visitor_role_id: role.id })
    .eq('guild_id', guildId);

  if (error) {
    // Log and respond with a database error embed if the upsert fails
    console.error('❌ Supabase error:', error);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Database Error',
            '❌ Failed to save the visitor role in the database.\n\n' +
            'Please try again later or contact a developer if the problem persists.'
          ),
        ],
      },
    };
  }

  // Success response embed confirming the visitor role has been set
  return {
    reply: {
      embeds: [
        cmdResponseEmbed(
          'Visitor Role Set',
          `✅ Visitor role has been set to ${role}.`
        ),
      ],
    },
    // Log object to be used for audit or moderation logs elsewhere
    log: {
      action: 'setVisitorRole',
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
