import { EmbedBuilder } from 'discord.js';
import supabase from '../supabaseClient.js';
import { isModerator } from '../utils/permissions.js';

const permissionLevel = 'Mod';

const data = {
  name: 'reactroles',
  description: 'Create a reaction role message with advanced syntax.',
  usage: '$reactroles #channel msg("Text") roles((emoji:@role), ...) config(toggle=true/false)',
};

async function execute(message, args) {
  const { data: config } = await supabase
    .from('config')
    .select('mod_role_id, admin_role_id')
    .eq('guild_id', message.guild.id)
    .single();

  if (!config) {
    return message.reply({
      embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Server is not configured. Use `$setup` first.')],
    });
  }

  const isMod = isModerator(message.member, config.mod_role_id, config.admin_role_id);
  if (!isMod) {
    return message.reply({
      embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ You do not have permission to use this command.')],
    });
  }

  if (args.length < 3) {
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor('Red')
          .setDescription('❌ Invalid command syntax.'),
      ],
    });
  }

  // Helper to parse quoted content inside parentheses, e.g. msg("text")
  function parseParenArg(str, key) {
    const regex = new RegExp(`${key}\\("([^"]+)"\\)`);
    const match = str.match(regex);
    return match ? match[1] : null;
  }

  // Helper to parse roles((emoji:@role), ...)
  function parseRoles(str) {
    const regex = /\(([^:]+):(<@&\d+>)\)/g;
    const mappings = {};
    let match;
    while ((match = regex.exec(str)) !== null) {
      const emoji = match[1].trim();
      const roleMention = match[2];
      mappings[emoji] = roleMention;
    }
    return mappings;
  }

  // Helper to parse config(toggle=true/false)
  function parseConfig(str) {
    const regex = /config\(toggle=(true|false)\)/;
    const match = str.match(regex);
    return match ? match[1] === 'true' : false;
  }

  // Parse channel mention
  const channelMention = args[0];
  const channelId = channelMention.replace(/[<#>]/g, '');
  const channel = await message.guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isText()) {
    return message.reply({
      embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Invalid channel mention or not a text channel.')],
    });
  }

  // Join rest of args for parsing msg(), roles(), config()
  const argsStr = args.slice(1).join(' ');

  // Parse message text
  const messageText = parseParenArg(argsStr, 'msg');
  if (!messageText) {
    return message.reply({
      embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ Missing or invalid msg(). Use msg("Your text")')],
    });
  }

  // Parse roles mapping
  const roleMappingsRaw = parseRoles(argsStr);
  if (Object.keys(roleMappingsRaw).length === 0) {
    return message.reply({
      embeds: [new EmbedBuilder().setColor('Red').setDescription('❌ You must specify at least one role mapping. Use roles((emoji:@role), ...)')],
    });
  }

  // Convert role mentions to IDs and validate
  const mappings = {};
  for (const [emoji, roleMention] of Object.entries(roleMappingsRaw)) {
    const roleId = roleMention.replace(/[<@&>]/g, '');
    const role = message.guild.roles.cache.get(roleId);
    if (!role) {
      return message.reply({
        embeds: [new EmbedBuilder().setColor('Red').setDescription(`❌ Invalid role mention: ${roleMention}`)],
      });
    }
    mappings[emoji] = role.id;
  }

  // Parse toggle config (default false)
  const togglable = parseConfig(argsStr);

  // Send the reaction role message
  const post = await channel.send(messageText);

  for (const emoji of Object.keys(mappings)) {
    try {
      await post.react(emoji);
    } catch (err) {
      console.warn(`Failed to react with emoji ${emoji}`, err);
    }
  }

  // Save to Supabase
  const { error } = await supabase.from('reaction_roles').insert({
    guild_id: message.guild.id,
    channel_id: channel.id,
    message_id: post.id,
    roles: mappings,
    togglable,
  });

  if (error) {
    console.error('Failed to save reaction role message:', error);
    return message.reply('❌ Failed to save reaction role message. Please try again.');
  }

  await message.reply('✅ Reaction role message successfully created and saved!');

  return {
    action: 'createReactRole',
    channelId: channel.id,
    messageId: post.id,
    mappings,
    togglable,
    createdBy: message.author.id,
  };
};

export default {
  permissionLevel,
  data,
  execute,
};