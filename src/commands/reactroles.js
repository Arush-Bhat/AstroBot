import { EmbedBuilder } from 'discord.js';
import supabase from '../supabaseClient.js';
import { isModerator } from '../utils/permissions.js';

const permissionLevel = 'Mod';

const data = {
  name: 'reactroles',
  description: 'Create a reaction role message with advanced syntax.',
  usage: '$reactroles #channel msg("Text") roles((emoji:@role), ...) config(toggle=true/false)',
};

async function execute(client, message, args, supabase) {
  console.log('✅ Command reactroles.js executed with args:', args);

  // Fetch mod/admin role settings from Supabase
  const { data: guild_settings } = await supabase
    .from('guild_settings')
    .select('mod_role_id, admin_role_id')
    .eq('guild_id', message.guild.id)
    .single();

  // Handle missing guild settings
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

  // Check if the user has mod or admin permissions
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

  // === UPDATED: Handle deletion mode ===
  // If first argument is a message ID and second is "clear", enter deletion mode
  if (
    args.length >= 2 &&
    /^\d{17,20}$/.test(args[0]) &&
    args[1].toLowerCase() === 'clear'
  ) {
    const targetMessageId = args[0];

    // Fetch reaction role entry from database
    const { data: entry } = await supabase
      .from('reaction_roles')
      .select('*')
      .eq('guild_id', message.guild.id)
      .eq('message_id', targetMessageId)
      .single();

    // If no such entry exists
    if (!entry) {
      return {
        reply: {
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('❌ Not Found')
              .setDescription('No such reaction role message exists for this message ID.'),
          ],
        },
      };
    }

    // Try fetching the original channel and message
    const channel = await message.guild.channels.fetch(entry.channel_id).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return {
        reply: {
          embeds: [
            new EmbedBuilder()
              .setColor('Red')
              .setTitle('❌ Invalid Channel')
              .setDescription('Could not resolve the message’s channel.'),
          ],
        },
      };
    }

    // Attempt to delete the old message
    const oldMsg = await channel.messages.fetch(targetMessageId).catch(() => null);
    if (oldMsg) await oldMsg.delete().catch(() => null);

    // Delete the entry from Supabase
    await supabase
      .from('reaction_roles')
      .delete()
      .eq('guild_id', message.guild.id)
      .eq('message_id', targetMessageId);

    // Return success response and log the deletion
    return {
      reply: { content: `🗑️ Reaction role message \`${targetMessageId}\` deleted.` },
      log: {
        action: 'reactionrole_deleted',
        executorUserId: message.author.id,
        executorTag: message.author.tag,
        guildId: message.guild.id,
        channelId: entry.channel_id,
        messageId: targetMessageId,
        reason: `Reaction role message deleted by ${message.author.tag} using $reactroles ${targetMessageId} clear.`,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // === Continue with creation mode ===

  // Minimum 2 args expected (channel and other config)
  if (args.length < 2) {
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

  // === Helper functions ===

  // Extracts the value from a key("value") format
  function parseParenArg(str, key) {
    const regex = new RegExp(`${key}\\("([^"]+)"\\)`);
    const match = str.match(regex);
    return match ? match[1] : null;
  }

  // Parses emoji-role pairs like (🔥:@role)
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

  // Parses toggle config: config(toggle=true/false)
  function parseConfig(str) {
    const regex = /config\(toggle=(true|false)\)/;
    const match = str.match(regex);
    return match ? match[1] === 'true' : false;
  }

  // Extract and validate target channel
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

  // Merge remaining args for parsing
  const argsStr = args.slice(1).join(' ');

  // Extract message content
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

  // Extract and validate role mappings
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

  // Validate roles and extract role IDs
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

  // Check if toggling is enabled
  const togglable = parseConfig(argsStr);

  // Send the actual message to the channel
  const post = await channel.send(messageText);

  // React with all specified emojis
  for (const emoji of Object.keys(mappings)) {
    try {
      await post.react(emoji);
    } catch (err) {
      console.warn(`Failed to react with emoji ${emoji}`, err);
    }
  }

  // Store the configuration in Supabase
  const { error } = await supabase.from('reaction_roles').insert({
    guild_id: message.guild.id,
    channel_id: channel.id,
    message_id: post.id,
    roles: mappings,
    togglable,
  });

  // Handle database failure
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

  // Return success response and log the creation
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
      reason: `Reaction role message created by ${message.author.tag} in #${channel.name}.`,
      timestamp: new Date().toISOString(),
    },
  };
}

export default {
  data,
  permissionLevel,
  execute,
};
