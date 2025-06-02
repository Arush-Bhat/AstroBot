import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import { setupHandlers } from './src/events/loader.js';
import { checkYouTubeUpdates } from './src/utils/ytchecker.js';  // adjust path if needed

dotenv.config();

console.log('Discord Token:', process.env.DISCORD_BOT_TOKEN ? '[SET]' : '[MISSING]');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION'],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Run once immediately
  checkYouTubeUpdates(client).catch(console.error);

  // Repeat every 5 minutes
  setInterval(() => {
    checkYouTubeUpdates(client).catch(console.error);
  }, 5 * 60 * 1000);
});

setupHandlers(client);

const app = express();
app.get('/', (_, res) => res.send('Bot is running'));
app.listen(process.env.PORT || 3000, () => {
  console.log('Express server started');
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
  console.error('Failed to login:', err);
  process.exit(1);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

