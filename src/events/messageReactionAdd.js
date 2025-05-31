import { Events } from 'discord.js';
import supabase from './src/supabaseClient'

export default {
  name: Events.MessageReactionAdd,
  async execute(reaction, user) {
    if (user.bot) return;

    const message = reaction.message;
    const emoji = reaction.emoji.name;

    try {
      // REACTION ROLES HANDLING
      const { data: reactionRole } = await supabase
        .from('reaction_roles')
        .select('*')
        .eq('message_id', message.id)
        .eq('emoji', emoji)
        .single();

      if (reactionRole) {
        const role = message.guild.roles.cache.get(reactionRole.role_id);
        const member = message.guild.members.cache.get(user.id);

        if (role && member) {
          // If it's togglable, remove the reaction after applying the role
          if (reactionRole.togglable) {
            if (member.roles.cache.has(role.id)) {
              await member.roles.remove(role);
              await reaction.users.remove(user.id);
              return;
            }
          }

          await member.roles.add(role);
          if (reactionRole.togglable) {
            await reaction.users.remove(user.id);
          }
        }

        return;
      }

      // POLLS HANDLING
      const { data: poll } = await supabase
        .from('polls')
        .select('*')
        .eq('message_id', message.id)
        .single();

      if (poll && !poll.is_multi) {
        // Remove all other user reactions on this message if poll is single-choice
        const userReactions = message.reactions.cache.filter(r =>
          r.users.cache.has(user.id)
        );

        for (const r of userReactions.values()) {
          if (r.emoji.name !== emoji) {
            await r.users.remove(user.id).catch(console.error);
          }
        }
      }
    } catch (err) {
      console.error(`Error handling messageReactionAdd:`, err);
    }
  },
};
