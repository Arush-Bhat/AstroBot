// src/commands/mute.js

const permissionLevel = 'Mod';

const data = {  
  name: 'mute',
  description: 'Mute a user for a specified duration (1min to 24hrs). Default is 2 mins. Moderator-level command.',
  usage: '$mute @user [duration]',
};

async function execute(client, message, args, supabase) {
  const guild = message.guild;
  const member = message.member;

  // Check if mod role is set and user has it (helper function can be used later)
  // For now, assume mod role check is done here:

  const guildId = guild.id;

  // Fetch mod and admin roles from Supabase
  const { data: settings, error } = await supabase
    .from('guild_settings')
    .select('mod_role_id, admin_role_id')
    .eq('guild_id', guildId)
    .single();

  if (error) {
    console.error(error);
    return message.reply({
      embeds: [{ color: 0xff0000, description: '❌ Database error fetching roles.' }],
    });
  }

  const modRoleId = settings?.mod_role_id;
  const adminRoleId = settings?.admin_role_id;

  if (!modRoleId) {
    return message.reply({
      embeds: [{ color: 0xff0000, description: '❌ Mod role not set. Use `$setmod @role` first.' }],
    });
  }

  // Check if user is mod or admin
  if (
    !member.roles.cache.has(modRoleId) &&
    !member.roles.cache.has(adminRoleId) &&
    !member.permissions.has('ADMINISTRATOR')
  ) {
    return message.reply({
      embeds: [{ color: 0xff0000, description: '❌ You do not have permission to mute users.' }],
    });
  }

  if (args.length < 1) {
    return message.reply({
      embeds: [{ color: 0xff0000, description: '❌ Please mention a user to mute.' }],
    });
  }

  // Get target user from mention
  const target = message.mentions.members.first();
  if (!target) {
    return message.reply({
      embeds: [{ color: 0xff0000, description: '❌ Please mention a valid user.' }],
    });
  }

  // Check if target is server owner ("king")
  if (target.id === guild.ownerId) {
    return message.reply({
      embeds: [{ color: 0xff0000, description: '❌ Cannot mute the server owner.' }],
    });
  }

  // Check that target is lower than command user in role hierarchy
  if (target.roles.highest.position >= member.roles.highest.position && message.author.id !== guild.ownerId) {
    return message.reply({
      embeds: [{ color: 0xff0000, description: '❌ You cannot mute someone with equal or higher role.' }],
    });
  }

  // Duration parsing - default 2 min
  let durationMs = 2 * 60 * 1000;
  if (args[1]) {
    const durationStr = args[1].toLowerCase();

    // Match pattern: 1min, 2mins, 4hrs, 1hour etc
    const match = durationStr.match(/^(\d+)(min|mins|hr|hrs|hour|hours)$/);
    if (!match) {
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ Invalid duration format. Use e.g. 1min, 5mins, 2hrs.' }],
      });
    }

    const amount = parseInt(match[1]);
    const unit = match[2];

    if (amount < 1) {
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ Duration must be at least 1 minute.' }],
      });
    }

    if (unit.startsWith('min')) {
      durationMs = amount * 60 * 1000;
    } else if (unit.startsWith('hr') || unit.startsWith('hour')) {
      durationMs = amount * 60 * 60 * 1000;
    }

    if (durationMs > 24 * 60 * 60 * 1000) {
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ Maximum mute duration is 24 hours.' }],
      });
    }
  }

  // Find or create Muted role
  let mutedRole = guild.roles.cache.find(r => r.name.toLowerCase() === 'muted');

  if (!mutedRole) {
    try {
      mutedRole = await guild.roles.create({
        name: 'Muted',
        color: 'GRAY',
        reason: 'Muted role needed for muting users',
        permissions: [],
      });

      // Deny send messages and add other permission denies in all text channels
      for (const [, channel] of guild.channels.cache) {
        if (channel.isText()) {
          await channel.permissionOverwrites.edit(mutedRole, {
            SendMessages: false,
            AddReactions: false,
            Speak: false,
          });
        }
      }
    } catch (err) {
      console.error(err);
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ Failed to create Muted role.' }],
      });
    }
  }

  if (target.roles.cache.has(mutedRole.id)) {
    return message.reply({
      embeds: [{ color: 0xff0000, description: '❌ User is already muted.' }],
    });
  }

  try {
    await target.roles.add(mutedRole, `Muted by ${message.author.tag} for ${durationMs / 60000} minutes.`);
  } catch (err) {
    console.error(err);
    return message.reply({
      embeds: [{ color: 0xff0000, description: '❌ Failed to assign Muted role.' }],
    });
  }

  message.reply({
    embeds: [{
      color: 0x00ff00,
      description: `🔇 Muted ${target.user.tag} for ${durationMs / 60000} minutes.`,
    }],
  });

  return {
  reason: `Muted ${target.user.tag} for ${durationMs / 60000} minutes.`,
    targetUserId: target.id,
  };

  // Remove mute after duration
  setTimeout(async () => {
    try {
      if (target.roles.cache.has(mutedRole.id)) {
        await target.roles.remove(mutedRole, 'Mute duration expired.');
        // Optional: Send DM or message that mute expired
      }
    } catch (err) {
      console.error('Error removing mute role:', err);
    }
  }, durationMs);
};

export default {
  permissionLevel,
  data,
  execute,
};