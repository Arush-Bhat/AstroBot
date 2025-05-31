import { EmbedBuilder } from 'discord.js';

export function cmdErrorEmbed(message, text) {
  const embed = new EmbedBuilder()
    .setTitle('❌ Error')
    .setDescription(text)
    .setColor('Red');
  return message.channel.send({ embeds: [embed] });
}

export function cmdWarningEmbed(message, text) {
  const embed = new EmbedBuilder()
    .setTitle('⚠️ Warning')
    .setDescription(text)
    .setColor('Yellow');
  return message.channel.send({ embeds: [embed] });
}

export function cmdResponseEmbed(message, text) {
  const embed = new EmbedBuilder()
    .setDescription(text)
    .setColor('Green');
  return message.channel.send({ embeds: [embed] });
}