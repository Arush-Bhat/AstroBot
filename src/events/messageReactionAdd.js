import supabase from '../supabaseClient.js';

export default async function messageReactionAdd(reaction, user, client) {
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
    // Fetch reaction_roles config for this message
    const { data: reactionRole, error: reactionRoleError } = await supabase
      .from('reaction_roles')
      .select('*')
      .eq('message_id', message.id)
      .single();

    if (reactionRoleError && reactionRoleError.code !== 'PGRST116') {
      console.error('Supabase error fetching reaction role:', reactionRoleError);
    }

    if (reactionRole) {
      const emojiKey = emoji.id ? `${emoji.name}:${emoji.id}` : emoji.name;
      const roleId = reactionRole.roles?.[emojiKey];

      if (!roleId) return;

      const member = await message.guild.members.fetch(user.id).catch(() => null);
      const role = message.guild.roles.cache.get(roleId);

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
      const userReactions = message.reactions.cache.filter(r =>
        r.users.cache.has(user.id)
      );

      for (const r of userReactions.values()) {
        if (r.emoji.name !== emoji.name) {
          await r.users.remove(user.id).catch(console.error);
        }
      }
    }
  } catch (err) {
    console.error('Error handling messageReactionAdd event:', err);
  }
}
