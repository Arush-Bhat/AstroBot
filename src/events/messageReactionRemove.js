const supabase = require('../supabaseClient');

module.exports = {
  name: 'messageReactionRemove',
  async execute(reaction, user) {
    if (user.bot) return;

    if (reaction.partial) {
      try {
        await reaction.fetch();
      } catch (err) {
        console.error('Failed to fetch reaction:', err);
        return;
      }
    }

    const { message, emoji } = reaction;

    // Get stored reaction role data
    const { data, error } = await supabase
      .from('reaction_roles')
      .select('*')
      .eq('guild_id', message.guild.id)
      .eq('channel_id', message.channel.id)
      .eq('message_id', message.id)
      .single();

    if (error || !data || !data.togglable) return;

    const emojiKey = emoji.id ? `<:${emoji.name}:${emoji.id}>` : emoji.name;
    const roleId = data.roles[emojiKey];
    if (!roleId) return;

    const member = await message.guild.members.fetch(user.id);
    if (!member) return;

    try {
      await member.roles.remove(roleId);
    } catch (err) {
      console.error('Failed to remove role:', err);
    }
  },
};
