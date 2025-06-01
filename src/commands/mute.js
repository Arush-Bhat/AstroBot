import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Mod';

const data = {  
  name: 'mute',
  description: 'Mute a user for a specified duration (1min to 24hrs). Default is 2 mins. Moderator-level command.',
  usage: '$mute @user [duration]',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command modch.js executed with args:', args);
  const guild = message.guild;
  const member = message.member;
  const guildId = guild.id;

  const { data: settings, error } = await supabase
    .from('guild_settings')
    .select('mod_role_id, admin_role_id')
    .eq('guild_id', guildId)
    .single();

  if (error) {
    console.error(error);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Database Error',
            '❌ Database error fetching roles.\n\nPlease try again later or contact support.'
          )
        ],
      },
    };
  }

  const modRoleId = settings?.mod_role_id;
  const adminRoleId = settings?.admin_role_id;

  if (!modRoleId) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Missing Mod Role',
            '❌ Mod role not set.\n\nPlease configure it using `$setmod @role` before using mute.'
          )
        ],
      },
    };
  }

  if (
    !member.roles.cache.has(modRoleId) &&
    !member.roles.cache.has(adminRoleId) &&
    !member.permissions.has('ADMINISTRATOR')
  ) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Permission Denied',
            '❌ You do not have permission to mute users.\n\n' +
            'Required: Moderator or Admin role, or Administrator permission.'
          )
        ],
      },
    };
  }

  if (args.length < 1) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Usage',
            '❌ Please mention a user to mute.\n\nUsage: `$mute @user [duration]`\nDuration formats: `2mins`, `1hour`, `3hrs` (optional, default 2 mins).'
          )
        ],
      },
    };
  }

  const target = message.mentions.members.first();
  if (!target) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid User',
            '❌ Please mention a valid user.\n\nExample: `$mute @username 10mins`'
          )
        ],
      },
    };
  }

  if (target.id === guild.ownerId) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Not Allowed',
            '❌ Cannot mute the server owner.'
          )
        ],
      },
    };
  }

  if (
    target.roles.highest.position >= member.roles.highest.position &&
    message.author.id !== guild.ownerId
  ) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Not Allowed',
            '❌ You cannot mute someone with equal or higher role.\n\n' +
            'Ensure your role is higher than the target user.'
          )
        ],
      },
    };
  }

  // Duration handling
  let durationMs = 2 * 60 * 1000; // Default 2 minutes
  if (args[1]) {
    const match = args[1].toLowerCase().match(/^(\d+)(min|mins|hr|hrs|hour|hours)$/);
    if (!match) {
      return {
        reply: {
          embeds: [
            cmdErrorEmbed(
              'Invalid Duration',
              '❌ Duration format invalid.\n\nUse formats like `2mins`, `1hour`, `3hrs`.'
            )
          ],
        },
      };
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2];

    if (amount < 1) {
      return {
        reply: {
          embeds: [
            cmdErrorEmbed(
              'Invalid Duration',
              '❌ Duration must be at least 1 minute.'
            )
          ],
        },
      };
    }

    durationMs = unit.startsWith('min')
      ? amount * 60 * 1000
      : amount * 60 * 60 * 1000;

    if (durationMs > 24 * 60 * 60 * 1000) {
      return {
        reply: {
          embeds: [
            cmdErrorEmbed(
              'Too Long',
              '❌ Maximum mute duration is 24 hours.'
            )
          ],
        },
      };
    }
  }

  // Get or create muted role
  let mutedRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');
  if (!mutedRole) {
    try {
      mutedRole = await guild.roles.create({
        name: 'Muted',
        color: '#646464',
        reason: 'Muted role created for moderation.',
        permissions: [],
      });

      for (const [, channel] of guild.channels.cache) {
        if (channel.isTextBased?.()) {
          await channel.permissionOverwrites.edit(mutedRole, {
            SendMessages: false,
            AddReactions: false,
            Speak: false,
          });
        }
      }
    } catch (err) {
      console.error(err);
      return {
        reply: {
          embeds: [
            cmdErrorEmbed(
              'Error',
              '❌ Failed to create Muted role.\n\nCheck bot permissions and try again.'
            )
          ],
        },
      };
    }
  }

  if (target.roles.cache.has(mutedRole.id)) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Already Muted',
            '❌ User is already muted.'
          )
        ],
      },
    };
  }

  try {
    await target.roles.add(mutedRole, `Muted by ${message.author.tag} for ${durationMs / 60000} minutes.`);
  } catch (err) {
    console.error(err);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Error',
            '❌ Failed to assign Muted role.\n\nCheck bot permissions and role hierarchy.'
          )
        ],
      },
    };
  }

  setTimeout(async () => {
    try {
      const refreshedTarget = await guild.members.fetch(target.id).catch(() => null);
      if (refreshedTarget && refreshedTarget.roles.cache.has(mutedRole.id)) {
        await refreshedTarget.roles.remove(mutedRole, 'Mute duration expired.');
      }
    } catch (err) {
      console.error('Error removing mute role:', err);
    }
  }, durationMs);

  return {
    reply: {
      embeds: [
        cmdResponseEmbed(
          'User Muted',
          `🔇 Muted ${target.user.tag} for ${durationMs / 60000} minutes.`,
          'Yellow'
        ),
      ],
    },
    log: {
      action: 'mute',
      executorUserId: message.author.id,
      executorTag: message.author.tag,
      targetUserId: target.id,
      targetTag: target.user.tag,
      duration: `${durationMs / 60000}m`,
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
