// src/events/interactionCreate.js
import supabase from '../supabaseClient.js';

export default async function interactionCreate(interaction, client) {
  if (!interaction.isButton()) return;
  if (interaction.customId !== 'nickset_button') return;

  try {
    await interaction.deferUpdate();
  } catch (err) {
    console.error('❌ Failed to defer interaction:', err);
    return;
  }

  let member;
  try {
    member = await interaction.guild.members.fetch(interaction.user.id);
  } catch (err) {
    console.error('❌ Failed to fetch member:', err);
    return;
  }

  console.log(`⚡ Nickname setup started for ${interaction.user.tag} in ${interaction.guild.name}`);

  // Fetch role info from Supabase
  const { data, error } = await supabase
    .from('guild_settings')
    .select('member_role_id, visitor_role_id')
    .eq('guild_id', interaction.guild.id)
    .single();

  if (error || !data?.member_role_id || !data?.visitor_role_id) {
    console.error('❌ Supabase fetch error:', error);
    try {
      await interaction.user.send('❌ Could not load role configuration. Please contact an admin.');
    } catch (_) {}
    return;
  }

  const memberRole = interaction.guild.roles.cache.get(data.member_role_id);
  const visitorRole = interaction.guild.roles.cache.get(data.visitor_role_id);

  if (!memberRole || !visitorRole) {
    try {
      await interaction.user.send('❌ One or more roles are missing in the server. Please contact an admin.');
    } catch (_) {}
    return;
  }

  // If user already has member role or doesn't have visitor role, don't proceed
  if (member.roles.cache.has(memberRole.id)) {
    await interaction.user.send('✅ You already have the member role.');
    return;
  }

  if (!member.roles.cache.has(visitorRole.id)) {
    await interaction.user.send('❌ You must have the visitor role to use this setup.');
    return;
  }

  // Check bot permissions and role hierarchy
  const botMember = interaction.guild.members.me;
  const botHighest = botMember.roles.highest.position;
  const userHighest = member.roles.highest.position;

  if (
    !botMember.permissions.has('ManageRoles') ||
    memberRole.position >= botHighest ||
    visitorRole.position >= botHighest ||
    userHighest >= botHighest
  ) {
    try {
      await interaction.user.send(
        '❌ I can’t update your nickname or roles due to role hierarchy or missing permissions. Please contact an admin.'
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
    } catch (err) {
      console.error('❌ Failed to set nickname:', err);
      await dm.send('❌ Failed to set your nickname. I might lack permission.');
      return;
    }

    try {
      await member.roles.add(memberRole);
      console.log(`➕ Added member role to ${member.user.tag}`);
    } catch (err) {
      console.error('❌ Failed to add member role:', err);
      await dm.send('❌ Failed to assign member role. Please contact an admin.');
      return;
    }

    try {
      await member.roles.remove(visitorRole);
      console.log(`➖ Removed visitor role from ${member.user.tag}`);
    } catch (err) {
      console.warn('⚠️ Failed to remove visitor role:', err);
      await dm.send('⚠️ Could not remove your previous role. Please contact an admin.');
    }

    await dm.send('✅ Nickname set and roles updated. Welcome!');
  } catch (err) {
    console.error('❌ Nickname setup error:', err);
    try {
      await interaction.user.send(
        '❌ An error occurred during nickname setup. Please try again later or contact an admin.'
      );
    } catch (dmErr) {
      console.error('❌ Failed to DM user:', dmErr);
    }
  }
}
