// src/commands/modch.js

module.exports = {
  name: 'modch',
  description: 'Set or get the moderator commands channel. Administrator-level command.',
  async execute(client, message, args, supabase) {
    // Check if user has admin role set in DB
    const guildId = message.guild.id;
    const member = message.member;

    // Fetch admin role for this guild from Supabase
    const { data: adminData, error: adminError } = await supabase
      .from('guild_settings')
      .select('admin_role_id')
      .eq('guild_id', guildId)
      .single();

    if (adminError) {
      console.error(adminError);
      return message.reply({
        embeds: [{
          color: 0xff0000,
          description: '❌ Error fetching admin role from database.',
        }],
      });
    }

    const adminRoleId = adminData?.admin_role_id;

    if (!adminRoleId) {
      return message.reply({
        embeds: [{
          color: 0xff0000,
          description: '❌ Admin role not set. Use `$setadmin @role` first.',
        }],
      });
    }

    // Check if member has admin role or higher
    if (!member.roles.cache.has(adminRoleId) && !member.permissions.has('ADMINISTRATOR')) {
      return message.reply({
        embeds: [{
          color: 0xff0000,
          description: '❌ You do not have permission to use this command. Administrator role required.',
        }],
      });
    }

    // If no args, reply with current modch channel or 'N/A'
    if (args.length === 0) {
      const { data, error } = await supabase
        .from('guild_settings')
        .select('modch_channel_id')
        .eq('guild_id', guildId)
        .single();

      if (error) {
        console.error(error);
        return message.reply({
          embeds: [{
            color: 0xff0000,
            description: '❌ Error fetching modch channel from database.',
          }],
        });
      }

      const modchId = data?.modch_channel_id;
      const modchChannel = modchId ? message.guild.channels.cache.get(modchId) : null;

      return message.reply({
        embeds: [{
          color: 0x00ff00,
          description: `🛠️ Moderator commands channel is: ${modchChannel ? modchChannel.toString() : 'N/A'}`,
        }],
      });
    }

    // Else expect one argument: a channel mention
    const channelMention = args[0];
    const channelIdMatch = channelMention.match(/^<#(\d+)>$/);
    if (!channelIdMatch) {
      return message.reply({
        embeds: [{
          color: 0xff0000,
          description: '❌ Please mention a valid channel. Usage: `$modch #channel`',
        }],
      });
    }
    const channelId = channelIdMatch[1];
    const channel = message.guild.channels.cache.get(channelId);
    if (!channel) {
      return message.reply({
        embeds: [{
          color: 0xff0000,
          description: '❌ The specified channel does not exist in this server.',
        }],
      });
    }

    // Update or insert modch channel for this guild in Supabase
    const { data: existing, error: fetchError } = await supabase
      .from('guild_settings')
      .select('guild_id')
      .eq('guild_id', guildId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // 116 = no rows found, so ignore
      console.error(fetchError);
      return message.reply({
        embeds: [{
          color: 0xff0000,
          description: '❌ Database error while fetching guild settings.',
        }],
      });
    }

    if (existing) {
      // Update existing row
      const { error: updateError } = await supabase
        .from('guild_settings')
        .update({ modch_channel_id: channelId })
        .eq('guild_id', guildId);

      if (updateError) {
        console.error(updateError);
        return message.reply({
          embeds: [{
            color: 0xff0000,
            description: '❌ Failed to update modch channel in the database.',
          }],
        });
      }
    } else {
      // Insert new row with modch_channel_id
      const { error: insertError } = await supabase
        .from('guild_settings')
        .insert({ guild_id: guildId, modch_channel_id: channelId });

      if (insertError) {
        console.error(insertError);
        return message.reply({
          embeds: [{
            color: 0xff0000,
            description: '❌ Failed to insert modch channel in the database.',
          }],
        });
      }
    }

    return message.reply({
      embeds: [{
        color: 0x00ff00,
        description: `✅ Moderator commands channel set to ${channel.toString()}`,
      }],
    });
  },
};