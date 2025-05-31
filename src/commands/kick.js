// src/commands/kick.js

module.exports = {
  name: 'kick',
  description: 'Kick a user from the server. Moderator-level command.',
  usage: '$kick @user',
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
        embeds: [{ color: 0xff0000, description: '❌ You do not have permission to kick users.' }],
      });
    }

    if (args.length < 1) {
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ Please mention a user to kick.' }],
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
        embeds: [{ color: 0xff0000, description: '❌ Cannot kick the server owner.' }],
      });
    }

    // Check that target is lower than command user in role hierarchy
    if (target.roles.highest.position >= member.roles.highest.position && message.author.id !== guild.ownerId) {
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ You cannot kick someone with equal or higher role.' }],
      });
    }

    try {
      await target.kick(`Kicked by ${message.author.tag}`);
      return message.reply({
        embeds: [{
          color: 0x00ff00,
          description: `👢 Kicked ${target.user.tag} successfully.`,
        }],
      });
    } catch (err) {
      console.error(err);
      return message.reply({
        embeds: [{ color: 0xff0000, description: '❌ Failed to kick the user. Check bot permissions.' }],
      });
    }
  },
};
