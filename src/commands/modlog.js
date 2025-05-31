import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embedHelpers.js';

export const permissionLevel = 'Admin';

export default {
  name: 'modlog',
  description: 'Set or get the moderator log channel. Administrator-level command.',

  async execute(client, message, args, supabase) {
    const guildId = message.guild.id;
    const member = message.member;

    // Fetch admin role
    const { data: adminData, error: adminError } = await supabase
      .from('guild_settings')
      .select('admin_role_id')
      .eq('guild_id', guildId)
      .single();

    if (adminError) {
      console.error(adminError);
      return {
        reply: await cmdErrorEmbed(message, 'Error fetching admin role from database.'),
      };
    }

    const adminRoleId = adminData?.admin_role_id;

    if (!adminRoleId) {
      return {
        reply: await cmdErrorEmbed(message, 'Use `$setadmin @role` first.'),
      };
    }

    if (!member.roles.cache.has(adminRoleId) && !member.permissions.has('ADMINISTRATOR')) {
      return {
        reply: await cmdErrorEmbed(message, 'Administrator role required.'),
      };
    }

    if (args.length === 0) {
      const { data, error } = await supabase
        .from('guild_settings')
        .select('modlog_channel_id')
        .eq('guild_id', guildId)
        .single();

      if (error) {
        console.error(error);
        return {
          reply: await cmdErrorEmbed(message, 'Error fetching modlog channel from database.'),
        };
      }

      const modlogId = data?.modlog_channel_id;
      const modlogChannel = modlogId ? message.guild.channels.cache.get(modlogId) : null;

      return {
        reply: await cmdResponseEmbed(
          message,
          `📝 Moderator log channel is: ${modlogChannel ? modlogChannel.toString() : 'N/A'}`
        ),
      };
    }

    // Channel mention validation
    const channelMention = args[0];
    const channelIdMatch = channelMention.match(/^<#(\d+)>$/);
    if (!channelIdMatch) {
      return {
        reply: await cmdErrorEmbed(message, 'Please mention a valid channel. Usage: `$modlog #channel`.'),
      };
    }

    const channelId = channelIdMatch[1];
    const channel = message.guild.channels.cache.get(channelId);

    if (!channel) {
      return {
        reply: await cmdErrorEmbed(message, 'The specified channel does not exist in this server.'),
      };
    }

    // Upsert modlog_channel_id in database
    const { data: existing, error: fetchError } = await supabase
      .from('guild_settings')
      .select('guild_id')
      .eq('guild_id', guildId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error(fetchError);
      return {
        reply: await cmdErrorEmbed(message, 'Error while fetching guild settings.'),
      };
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from('guild_settings')
        .update({ modlog_channel_id: channelId })
        .eq('guild_id', guildId);

      if (updateError) {
        console.error(updateError);
        return {
          reply: await cmdErrorEmbed(message, 'Failed to update modlog channel.'),
        };
      }
    } else {
      const { error: insertError } = await supabase
        .from('guild_settings')
        .insert({ guild_id: guildId, modlog_channel_id: channelId });

      if (insertError) {
        console.error(insertError);
        return {
          reply: await cmdErrorEmbed(message, 'Failed to insert modlog channel.'),
        };
      }
    }

    return {
      reply: await cmdResponseEmbed(message, `✅ Moderator log channel set to ${channel.toString()}`),
      log: {
        action: 'modlog_set',
        executorUserId: message.author.id,
        executorTag: message.author.tag,
        guildId,
        channelId,
        channelName: channel.name,
        timestamp: new Date().toISOString(),
      },
    };
  },
};
