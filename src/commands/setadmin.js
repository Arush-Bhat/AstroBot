import supabase from './src/supabaseClient';
import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embedHelpers.js';

export const permissionLevel = 'Admin';

export default {
  name: 'setadmin',
  description: 'Set the administrator role',
  async execute(message, args) {
    if (!message.member.permissions.has('Administrator')) {
      return message.channel.send({
        embeds: [cmdErrorEmbed('❌ Permission Denied', 'You need Administrator permission to set the admin role.')]
      });
    }

    const role = message.mentions.roles.first();
    if (!role) {
      return message.channel.send({
        embeds: [cmdErrorEmbed('❌ Invalid Role', 'Please mention a valid role. Usage: `$setadmin @role`')]
      });
    }

    const guildId = message.guild.id;

    const { error } = await supabase
      .from('guild_settings')
      .upsert({ guild_id: guildId, admin_role_id: role.id })
      .eq('guild_id', guildId);

    if (error) {
      console.error(error);
      return message.channel.send({
        embeds: [cmdErrorEmbed('❌ Database Error', 'Failed to save the admin role. Please try again later.')]
      });
    }

    message.channel.send({
      embeds: [cmdResponseEmbed('✅ Administrator Role Set', `Administrator role has been set to ${role.name}.`)]
    });

    return {
      action: 'setAdminRole',
      roleId: role.id,
      roleName: role.name,
      moderatorId: message.author.id,
      moderatorTag: message.author.tag,
    };
  }
};
