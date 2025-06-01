// src/events/interactionCreate.js

export default async function interactionCreate(interaction, client, supabase) {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'nickset_button') {
    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (!member) return;

    try {
      await interaction.reply({
        content: '📩 Check your DMs to continue.',
        ephemeral: true,
      });

      // Fetch role info from guild_settings
      const { data, error } = await supabase
        .from('guild_settings')
        .select('roles')
        .eq('guild_id', interaction.guild.id)
        .single();

      if (error || !data?.roles?.role_to_add || !data?.roles?.role_to_remove) {
        console.error('❌ Failed to fetch roles from Supabase:', error);
        await interaction.user.send('❌ Could not load role configuration. Please contact an admin.');
        return;
      }

      const roleToAddId = data.roles.role_to_add;
      const roleToRemoveId = data.roles.role_to_remove;
      const roleToAdd = interaction.guild.roles.cache.get(roleToAddId);
      const roleToRemove = interaction.guild.roles.cache.get(roleToRemoveId);

      if (!roleToAdd || !roleToRemove) {
        await interaction.user.send('❌ One or more configured roles are missing in this server.');
        return;
      }

      // Ask for name in DM
      const dm = await interaction.user.createDM();
      await dm.send('📛 Please enter your **real name**. This will be set as your nickname.');

      const filter = m => m.author.id === interaction.user.id;
      const collected = await dm.awaitMessages({ filter, max: 1, time: 60000 });
      const name = collected.first()?.content;

      if (!name) {
        await dm.send('❌ No name received. Please try again later.');
        return;
      }

      await dm.send(`✅ Is **"${name}"** correct? Reply with \`y\` to confirm.`);
      const confirm = await dm.awaitMessages({ filter, max: 1, time: 30000 });
      const confirmation = confirm.first()?.content.toLowerCase();

      if (confirmation !== 'y') {
        await dm.send('❌ Confirmation failed. No changes were made.');
        return;
      }

      // Apply nickname and roles
      await member.setNickname(name, 'Nickname set via $nickset');
      await member.roles.add(roleToAdd);
      await member.roles.remove(roleToRemove);

      await dm.send('✅ Nickname set successfully and roles updated!');
    } catch (err) {
      console.error('Nickname interaction error:', err);
      try {
        await interaction.user.send(
          '❌ An error occurred while setting your nickname. Please ensure:\n' +
          '- Your DMs are open\n' +
          '- I have permission to change nicknames and manage roles\n\n' +
          'Then try again.'
        );
      } catch (_) {}
    }
  }
}
