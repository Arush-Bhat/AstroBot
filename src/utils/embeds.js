import { EmbedBuilder } from 'discord.js';

/**
 * Creates an error embed with a dynamic title format "❌ Error | {title_text}"
 * @param {string} description - The embed description text
 * @param {string} [title='Error'] - The custom title text appended after emoji and category
 */
export function cmdErrorEmbed(description, title = 'Error') {
  return new EmbedBuilder()
    .setTitle(`❌ Error | ${title}`)
    .setDescription(description)
    .setColor('Red');
}

/**
 * Creates a warning embed with a dynamic title format "⚠️ Warning | {title_text}"
 * @param {string} description - The embed description text
 * @param {string} [title='Warning'] - The custom title text appended after emoji and category
 */
export function cmdWarningEmbed(description, title = 'Warning') {
  return new EmbedBuilder()
    .setTitle(`⚠️ Warning | ${title}`)
    .setDescription(description)
    .setColor('Yellow');
}

/**
 * Creates a response embed with a dynamic title format "✅ Success | {title_text}"
 * @param {string} description - The embed description text
 * @param {string} [title='Success'] - The custom title text appended after emoji and category
 */
export function cmdResponseEmbed(description, title = 'Success') {
  return new EmbedBuilder()
    .setTitle(`✅ Success | ${title}`)
    .setDescription(description)
    .setColor('Green');
}
