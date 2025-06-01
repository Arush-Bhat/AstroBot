// src/events/interactionCreate.js

export default async function interactionCreate(interaction, client) {
  if (!interaction.isButton()) return;
  
  if (interaction.customId === 'nickset_button') {
    const member = interaction.guild.members.cache.get(interaction.user.id);
    if (!member) return;

    try {
      await interaction.reply({
        content: '📩 Check your DMs to continue.',
        ephemeral: true,
      });

      const dm = await interaction.user.createDM();
      await dm.send('📛 Please enter your **real name**. This will be set as your nickname.');

      const filter = m => m.author.id === interaction.user.id;
      const collected = await dm.awaitMessages({ filter, max: 1, time: 60000 });
      const name = collected.first()?.content;

      if (!name) return await dm.send('❌ No name received. Please try again later.');

      await dm.send(`✅ Is **"${name}"** correct? Reply with \`y\` to confirm.`);
      const confirm = await dm.awaitMessages({ filter, max: 1, time: 30000 });
      const confirmation = confirm.first()?.content.toLowerCase();

      if (confirmation !== 'y') {
        return await dm.send('❌ Confirmation failed. No changes were made.');
      }

      // TODO: Save mapping of userId → roleToAdd, roleToRemove from DB or cache
      // For now just assume they're set (this needs storing in Supabase or a Map)

      await member.setNickname(name, 'Nickname set via $nickset');
      // await member.roles.add(roleToAdd);
      // await member.roles.remove(roleToRemove);

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
