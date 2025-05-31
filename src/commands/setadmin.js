import { EmbedBuilder } from 'discord.js';
import supabase from './src/supabaseClient'

export default {
  name: 'setadmin',
  description: 'Set the administrator role',
  async execute(message, args) {
    if (!message.member.permissions.has('Administrator')) {
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Permission Denied')
            .setDescription('You need Administrator permission to set the admin role.')
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
            .setDescription('Please mention a valid role. Usage: `$setadmin @role`')
            .setColor('Red')
        ]
      });
    }

    const guildId = message.guild.id;

    const { data, error } = await supabase
      .from('guild_settings')
      .upsert({ guild_id: guildId, admin_role_id: role.id })
      .eq('guild_id', guildId);

    if (error) {
      console.error(error);
      return message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('❌ Database Error')
            .setDescription('Failed to save the admin role. Please try again later.')
            .setColor('Red')
        ]
      });
    }

    message.channel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Administrator Role Set')
          .setDescription(`Administrator role has been set to ${role.name}.`)
          .setColor('Green')
      ]
    });
  }
};