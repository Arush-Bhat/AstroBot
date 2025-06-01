// src/events/interactionCreate.js
import supabase from '../supabaseClient.js'; // adjust path if needed

export default async function interactionCreate(interaction, client) {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'nickset_button') {
    let member;
    try {
      // Immediately acknowledge button interaction silently
      await interaction.deferUpdate();
    } catch (err) {
      console.error('❌ Failed to deferUpdate interaction:', err);
      return;
    }

    try {
      // Fetch fresh member data to avoid stale cache issues
      member = await interaction.guild.members.fetch(interaction.user.id);
    } catch (err) {
      console.error('❌ Failed to fetch member:', err);
      return;
    }

    if (!member) {
      console.error('❌ Member not found in guild');
      return;
    }

    console.log(`⚡ Nickname setup started for ${interaction.user.tag} in ${interaction.guild.name}`);

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

    console.log('📦 Supabase roles:', data.roles);

    const roleToAddId = data.roles.role_to_add;
    const roleToRemoveId = data.roles.role_to_remove;

    const roleToAdd = interaction.guild.roles.cache.get(roleToAddId);
    const roleToRemove = interaction.guild.roles.cache.get(roleToRemoveId);

    console.log('🎯 Role to add:', roleToAdd?.name, roleToAddId);
    console.log('🗑️ Role to remove:', roleToRemove?.name, roleToRemoveId);

    if (!roleToAdd || !roleToRemove) {
      try {
        await interaction.user.send('❌ One or more roles are missing in the server. Please contact an admin.');
      } catch (_) {}
      return;
    }

    // Check bot permissions and role hierarchy
    const botMember = interaction.guild.members.me;
    const botHighest = botMember.roles.highest.position;
    const userHighest = member.roles.highest.position;

    console.log('🔍 Bot permissions:', botMember.permissions.toArray());
    console.log('🔍 Bot can Manage Roles:', botMember.permissions.has('ManageRoles'));
    console.log('🔍 Bot highest role position:', botHighest);
    console.log('🔍 roleToAdd position:', roleToAdd.position);
    console.log('🔍 roleToRemove position:', roleToRemove.position);
    console.log('🔍 User highest role position:', userHighest);
    console.log('🔍 Member current roles:', member.roles.cache.map(r => `${r.name} (${r.position})`).join(', '));

    if (
      !botMember.permissions.has('ManageRoles') ||
      roleToAdd.position >= botHighest ||
      roleToRemove.position >= botHighest ||
      userHighest >= botHighest
    ) {
      try {
        await interaction.user.send(
          '❌ I can’t update your nickname or roles because of permission or role hierarchy. Please contact an admin.'
        );
      } catch (_) {}
      console.warn('⚠️ Role hierarchy or permissions prevent action on', interaction.user.tag);
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
        console.log(`✅ Nickname set for ${interaction.user.tag}`);
      } catch (err) {
        console.error('❌ Failed to set nickname:', err);
        await dm.send('❌ Failed to set your nickname. I might lack permission.');
        return;
      }

      try {
        console.log(`➕ Adding role "${roleToAdd.name}" to ${member.user.tag}`);
        await member.roles.add(roleToAdd);
      } catch (err) {
        console.error('❌ Failed to add role:', err);
        await dm.send('❌ Failed to add your role. Please contact an admin.');
        return;
      }

      try {
        console.log(`➖ Removing role "${roleToRemove.name}" from ${member.user.tag}`);
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
