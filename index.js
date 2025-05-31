import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import express from 'express';
import { setupHandlers } from './src/events/loader.js'; // If you have a handler loader
import { sendErrorEmbed } from './src/utils/embeds.js'; // Move the utility here

dotenv.config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.DirectMessages,
  ],
  partials: ['CHANNEL'], // Needed for DMs
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Setup dynamic handler loading
setupHandlers(client);

// Optional Express server to keep Render happy
const app = express();
app.get('/', (_, res) => res.send('Bot is running'));
app.listen(process.env.PORT || 3000);

// Login
client.login(process.env.TOKEN);