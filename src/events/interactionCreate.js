const { Events, EmbedBuilder } = require('discord.js');
const supabase = require('../supabaseClient');

module.exports = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    if (!interaction.isButton()) return;

    const { customId, member, guild } = interaction;

    // Init Role button logic
    if (customId.startsWith('initrole-')) {
      const id = customId.split('-')[1];

      const { data, error } = await supabase
        .from('init_roles')
        .select('*')
        .eq('guild_id', guild.id)
        .eq('message_id', id)
        .single();

      if (error || !data) {
        return interaction.reply({ content: 'Role configuration not found.', ephemeral: true });
      }

      const added = [];
      const removed = [];

      for (const roleId of data.add_roles || []) {
        if (!member.roles.cache.has(roleId)) {
          await member.roles.add(roleId).catch(() => null);
          added.push(`<@&${roleId}>`);
        }
      }

      for (const roleId of data.remove_roles || []) {
        if (member.roles.cache.has(roleId)) {
          await member.roles.remove(roleId).catch(() => null);
          removed.push(`<@&${roleId}>`);
        }
      }

      await interaction.deferUpdate();

      await interaction.message.edit({ components: [] }); // disable the button

      await interaction.followUp({
        content: `✅ Roles updated!\n${added.length ? `Added: ${added.join(', ')}` : ''}\n${removed.length ? `Removed: ${removed.join(', ')}` : ''}`,
        ephemeral: true,
      });

      return;
    }

    // Polls (multi/single)
    if (customId.startsWith('poll-')) {
      const [_, messageId, emoji, isMulti] = customId.split('-');
      const msg = await interaction.channel.messages.fetch(messageId).catch(() => null);
      if (!msg) return interaction.reply({ content: 'Poll message not found.', ephemeral: true });

      const userId = interaction.user.id;

      // Remove all other reactions if not multi
      if (isMulti === 'false') {
        for (const [em, reaction] of msg.reactions.cache) {
          if (em !== emoji) {
            await reaction.users.remove(userId).catch(() => {});
          }
        }
      }

      // React on behalf of user
      await msg.react(emoji).catch(() => {});
      await interaction.reply({ content: `Voted with ${emoji}`, ephemeral: true });
      return;
    }

    // Reaction Role logic handled via raw reactions in messageReactionAdd/Remove
  }
};
