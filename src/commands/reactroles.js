import { EmbedBuilder } from 'discord.js';
import supabase from '../supabaseClient.js';
import { isModerator } from '../utils/permissions.js';
import { cmdErrorEmbed, cmdResponseEmbed } from '../utils/embeds.js';

const permissionLevel = 'Mod';

const data = {
  name: 'reactroles',
  description: 'Create a reaction role message with advanced syntax.',
  usage: '$reactroles #channel msg("Text") roles((emoji:@role), ...) config(toggle=true/false)',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command reactroles.js executed with args:', args);
  
  const { data: guild_settings } = await supabase
    .from('guild_settings')
    .select('mod_role_id, admin_role_id')
    .eq('guild_id', message.guild.id)
    .single();

  if (!guild_settings) {
    return {
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Error finding database')
            .setDescription('Please contact a developer regarding this issue.'),
        ],
      },
    };
  }

  const isMod = isModerator(message.member, guild_settings.mod_role_id, guild_settings.admin_role_id);
  if (!isMod) {
    return {
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Permission Denied')
            .setDescription('You need mod or admin privileges to use `$reactroles`.'),
        ],
      },
    };
  }

  if (args.length < 3) {
    return {
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Invalid Syntax')
            .setDescription(
              'Please provide all required arguments.\n\n' +
              '**Example:**\n' +
              '`$reactroles #channel msg("Choose a role:") roles((🔥:@role1), (❄️:@role2)) config(toggle=true)`'
            ),
        ],
      },
    };
  }

  function parseParenArg(str, key) {
    const regex = new RegExp(`${key}\\("([^"]+)"\\)`);
    const match = str.match(regex);
    return match ? match[1] : null;
  }

  function parseRoles(str) {
    const regex = /\(\s*([^\s:()]+)\s*:\s*(<@&\d+>)\s*\)/g;
    const mappings = {};
    let match;
    while ((match = regex.exec(str)) !== null) {
      const emoji = match[1].trim();
      const roleMention = match[2];
      mappings[emoji] = roleMention;
    }
    return mappings;
  }

  function parseConfig(str) {
    const regex = /config\(toggle=(true|false)\)/;
    const match = str.match(regex);
    return match ? match[1] === 'true' : false;
  }

  const channelMention = args[0];
  const channelId = channelMention.replace(/[<#>]/g, '');
  const channel = await message.guild.channels.fetch(channelId).catch(() => null);

  if (!channel || !channel.isTextBased()) {
    return {
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Invalid Channel')
            .setDescription('Please mention a valid text channel.\nExample: `$reactroles #roles`'),
        ],
      },
    };
  }

  const argsStr = args.slice(1).join(' ');

  const messageText = parseParenArg(argsStr, 'msg');
  if (!messageText) {
    return {
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Missing msg()')
            .setDescription('Include the message text using `msg("Your message here")`.'),
        ],
      },
    };
  }

  const roleMappingsRaw = parseRoles(argsStr);
  if (Object.keys(roleMappingsRaw).length === 0) {
    return {
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Missing Role Mappings')
            .setDescription(
              'You must specify at least one emoji-role pair.\n\n**Example:**\n' +
              '`roles((🔥:@role1), (❄️:@role2))`'
            ),
        ],
      },
    };
  }

  const mappings = {};
  for (const [emoji, roleMention] of Object.entries(roleMappingsRaw)) {
    const roleId = roleMention.replace(/[<@&>]/g, '');
    const role = message.guild.roles.cache.get(roleId);
    if (!role) {
      return {
        reply: {
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('❌ Invalid Role')
              .setDescription(`Role not found for: ${roleMention}`),
          ],
        },
      };
    }
    mappings[emoji] = role.id;
  }

  const togglable = parseConfig(argsStr);

  // Delete old reaction role message for the same guild+channel
  const { data: existing } = await supabase
    .from('reaction_roles')
    .select('message_id')
    .eq('guild_id', message.guild.id)
    .eq('channel_id', channel.id)
    .single();

  if (existing) {
    try {
      const oldMsg = await channel.messages.fetch(existing.message_id).catch(() => null);
      if (oldMsg) await oldMsg.delete();
    } catch (err) {
      console.warn('Failed to delete old reaction role message:', err);
    }

    await supabase
      .from('reaction_roles')
      .delete()
      .eq('guild_id', message.guild.id)
      .eq('channel_id', channel.id);
  }

  const post = await channel.send(messageText);

  for (const emoji of Object.keys(mappings)) {
    try {
      await post.react(emoji);
    } catch (err) {
      console.warn(`Failed to react with emoji ${emoji}`, err);
    }
  }

  const { error } = await supabase.from('reaction_roles').insert({
    guild_id: message.guild.id,
    channel_id: channel.id,
    message_id: post.id,
    roles: mappings,
    togglable,
  });

  if (error) {
    console.error('Supabase error saving reaction roles:', error);
    return {
      reply: {
        embeds: [
          new EmbedBuilder()
            .setColor('Red')
            .setTitle('❌ Database Error')
            .setDescription('Could not save the reaction roles to the database. Please try again later.'),
        ],
      },
    };
  }

  return {
    reply: {
      content: '✅ Reaction role message successfully created and saved!',
    },
    log: {
      action: 'reactionrole_created',
      executorUserId: message.author.id,
      executorTag: message.author.tag,
      guildId: message.guild.id,
      channelId: channel.id,
      messageId: post.id,
      mappings: JSON.stringify(mappings),
      togglable: togglable.toString(),
      timestamp: new Date().toISOString(),
    },
  };
}

export default {
  data,
  permissionLevel,
  execute,
};
