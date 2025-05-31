import supabase from '../supabaseClient.js';

export default async function messageReactionAdd(reaction, user, client) {
  if (user.bot) return;

  const { message, emoji } = reaction;

  try {
    // REACTION ROLES HANDLING
    const { data: reactionRole, error: reactionRoleError } = await supabase
      .from('reaction_roles')
      .select('*')
      .eq('message_id', message.id)
      .eq('emoji', emoji.name)
      .single();

    if (reactionRoleError && reactionRoleError.code !== 'PGRST116') {
      console.error('Supabase error fetching reaction role:', reactionRoleError);
    }

    if (reactionRole) {
      const role = message.guild.roles.cache.get(reactionRole.role_id);
      const member = message.guild.members.cache.get(user.id);

      if (!role || !member) return;

      if (reactionRole.togglable && member.roles.cache.has(role.id)) {
        await member.roles.remove(role).catch(console.error);
        await reaction.users.remove(user.id).catch(console.error);
        return;
      }

      await member.roles.add(role).catch(console.error);

      if (reactionRole.togglable) {
        await reaction.users.remove(user.id).catch(console.error);
      }

      return;
    }

    // POLLS HANDLING
    const { data: poll, error: pollError } = await supabase
      .from('polls')
      .select('*')
      .eq('message_id', message.id)
      .single();

    if (pollError && pollError.code !== 'PGRST116') {
      console.error('Supabase error fetching poll:', pollError);
    }

    if (poll && !poll.is_multi) {
      const userReactions = message.reactions.cache.filter(r => r.users.cache.has(user.id));

      for (const r of userReactions.values()) {
        if (r.emoji.name !== emoji.name) {
          await r.users.remove(user.id).catch(console.error);
        }
      }
    }
  } catch (err) {
    console.error('Error handling messageReactionAdd event:', err);
  }
};
