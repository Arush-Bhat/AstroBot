import supabase from '../supabaseClient.js';

export default async function messageReactionRemove(reaction, user, client) {
  if (user.bot) return;

  // Fetch full reaction object if partial
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch (err) {
      console.error('Failed to fetch reaction:', err);
      return;
    }
  }

  const { message, emoji } = reaction;

  try {
    // Fetch reaction role for this message and emoji
    const { data: reactionRole, error } = await supabase
      .from('reaction_roles')
      .select('*')
      .eq('message_id', message.id)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') {
        console.error('Supabase error fetching reaction role:', error);
      }
      return; // no reaction role configured or db error
    }

    // Only process if role is togglable (removal on reaction remove)
    if (!reactionRole.togglable) return;

    const roleId = reactionRole.role_id;
    if (!roleId || !reactionRole.togglable) return;

    const member = await message.guild.members.fetch(user.id).catch(() => null);
    if (!member) {
      await member.roles.remove(roleId).catch(console.error);
    };

    await member.roles.remove(roleId).catch(err => {
      console.error('Failed to remove role:', err);
    });
  } catch (err) {
    console.error('Error handling messageReactionRemove:', err);
  }
};