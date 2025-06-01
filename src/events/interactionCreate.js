// src/events/interactionCreate.js

export default async function interactionCreate(interaction, client, supabase) {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'nickset_button') {
    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (!member) return;

    console.log(`⚡ Nickname setup started for ${interaction.user.tag} in ${interaction.guild.name}`);

    try {
      await interaction.reply({
        content: '📩 Check your DMs to continue.',
        flags: 64, // ephemeral
      });
    } catch (err) {
      console.error('❌ Failed to reply to interaction:', err);
      return;
    }

    // Fetch role info from Supabase
    const { data, error } = await supabase
      .from('guild_settings')
      .select('roles')
      .eq('guild_id', interaction.guild.id)
      .single();

    if (error || !data?.roles?.role_to_add || !data?.roles?.role_to_remove) {
      console.error('❌ Supabase fetch error:', error);
      try {
        await interaction.user.send('❌ Could not load role configuration. Please contact an admin.');
      } catch (_) {}
      return;
    }

    const roleToAddId = data.roles.role_to_add;
    const roleToRemoveId = data.roles.role_to_remove;

    const roleToAdd = interaction.guild.roles.cache.get(roleToAddId);
    const roleToRemove = interaction.guild.roles.cache.get(roleToRemoveId);

    if (!roleToAdd || !roleToRemove) {
      try {
        await interaction.user.send('❌ One or more roles are missing in the server. Please contact an admin.');
      } catch (_) {}
      return;
    }

    // Role hierarchy check
    const botMember = interaction.guild.members.me;
    const botHighest = botMember.roles.highest.position;
    const userHighest = member.roles.highest.position;

    if (
      roleToAdd.position >= botHighest ||
      roleToRemove.position >= botHighest ||
      userHighest >= botHighest
    ) {
      try {
        await interaction.user.send(
          '❌ I can’t update your nickname or roles because of role hierarchy. Please contact an admin.'
        );
      } catch (_) {}
      console.warn('⚠️ Role hierarchy prevents action on', interaction.user.tag);
      return;
    }

    try {
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

      console.log(`🔧 Setting nickname "${name}" for ${interaction.user.tag}`);

      try {
        await member.setNickname(name, 'Nickname set via $nickset');
      } catch (err) {
        console.error('❌ Failed to set nickname:', err);
        await dm.send('❌ Failed to set your nickname. I might lack permission.');
        return;
      }

      try {
        await member.roles.add(roleToAdd);
      } catch (err) {
        console.error('❌ Failed to add role:', err);
        await dm.send('❌ Failed to add your role. Please contact an admin.');
        return;
      }

      try {
        await member.roles.remove(roleToRemove);
      } catch (err) {
        console.error('❌ Failed to remove role:', err);
        await dm.send('⚠️ Failed to remove your previous role. Please contact an admin.');
        // continue anyway
      }

      await dm.send('✅ Nickname set successfully and roles updated!');
    } catch (err) {
      console.error('Nickname interaction error:', err);
      try {
        await interaction.user.send(
          '❌ An unexpected error occurred while setting your nickname. Please try again later.'
        );
      } catch (dmErr) {
        console.error('❌ Failed to send error DM to user:', dmErr);
      }
    }
  }
}
