import { EmbedBuilder } from 'discord.js';
import supabase from './src/supabaseClient'

export default {
  name: 'setmod',
  description: 'Set the moderator role',
  async execute(message, args) {
    if (!message.member.permissions.has('Administrator')) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Permission Denied')
            .setDescription('You need Administrator permission to set the mod role.')
            .setColor('Red')
        ]
      });
    }

    const role = message.mentions.roles.first();
    if (!role) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Invalid Role')
            .setDescription('Please mention a valid role. Usage: `$setmod @role`')
            .setColor('Red')
        ]
      });
    }

    // Save to Supabase: key by guild ID
    const guildId = message.guild.id;

    // Upsert mod role for guild
    const { data, error } = await supabase
      .from('guild_settings')
      .upsert({ guild_id: guildId, mod_role_id: role.id })
      .eq('guild_id', guildId);

    if (error) {
      console.error(error);
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Database Error')
            .setDescription('Failed to save the mod role. Please try again later.')
            .setColor('Red')
        ]
      });
    }

    message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Moderator Role Set')
          .setDescription(`Moderator role has been set to ${role.name}.`)
          .setColor('Green')
      ]
    });
  }
};
