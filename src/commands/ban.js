// src/commands/ban.js

export default {
  name: 'ban',
  description: 'Ban a user from the server. Administrator-level command.',
  usage: '$ban @user',
  async execute(client, message, args, supabase) {
    const guild = message.guild;
    const member = message.member;

    // Fetch mod and admin roles from Supabase
    const { data: settings, error } = await supabase
      .from('guild_settings')
      .select('mod_role_id, admin_role_id')
      .eq('guild_id', guild.id)
      .single();

    if (error) {
      console.error(error);
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ Database error fetching roles.' }],
      });
    }

    const adminRoleId = settings?.admin_role_id;

    if (!adminRoleId) {
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ Admin role not set. Use `$setadmin @role` first.' }],
      });
    }

    // Check if user is admin (or has ADMINISTRATOR permission)
    if (
      !member.roles.cache.has(adminRoleId) &&
      !member.permissions.has('ADMINISTRATOR')
    ) {
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ You do not have permission to ban users.' }],
      });
    }

    if (args.length < 1) {
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ Please mention a user to ban.' }],
      });
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ Please mention a valid user.' }],
      });
    }

    // Prevent banning server owner ("king")
    if (target.id === guild.ownerId) {
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ Cannot ban the server owner.' }],
      });
    }

    // Check role hierarchy (admin can ban anyone lower than themselves)
    if (target.roles.highest.position >= member.roles.highest.position && message.author.id !== guild.ownerId) {
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ You cannot ban someone with equal or higher role.' }],
      });
    }

    try {
      await target.ban({ reason: `Banned by ${message.author.tag}` });
      return message.reply({
        embeds: [{
          color: 0x00ff00,
          description: `🔨 Banned ${target.user.tag} successfully.`,
        }],
      });
    } catch (err) {
      console.error(err);
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ Failed to ban the user. Check bot permissions.' }],
      });
    }
  },
};
