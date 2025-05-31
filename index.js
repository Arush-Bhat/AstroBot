import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import { setupHandlers } from './src/events/loader.js';

dotenv.config();

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
});

setupHandlers(client);

const app = express();
app.get('/', (_, res) => res.send('Bot is running'));
app.listen(process.env.PORT || 3000, () => {
  console.log('Express server started');
});

client.login(process.env.TOKEN).catch(err => {
  console.error('Failed to login:', err);
  process.exit(1);
});

process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});
