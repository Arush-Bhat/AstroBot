import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logCommand } from '../utils/modlog.js';
import supabase from '../supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupHandlers(client) {
  // === Load Event Handlers ===
  const eventsPath = path.join(__dirname);
  const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js') && file !== 'loader.js');

  for (const file of eventFiles) {
    try {
      const event = await import(`./${file}`);
      const eventName = file.split('.')[0];
      client.on(eventName, (...args) => event.default(...args, client));
      console.log(`✅ Loaded event: ${eventName}`);
    } catch (err) {
      console.error(`❌ Failed to load event ${file}:`, err);
    }
  }

  // === Load Commands ===
  client.commands = new Map();
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    try {
      const command = await import(`../commands/${file}`);
      client.commands.set(command.default.name, command.default);
      console.log(`📦 Loaded command: ${command.default.name}`);
    } catch (err) {
      console.error(`❌ Failed to load command ${file}:`, err);
    }
  }

  // === Setup messageCreate listener for prefix commands ===
  client.on('messageCreate', async message => {
    const prefix = '$';
    if (!message.guild || message.author.bot || !message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);

    if (!command) return;

    try {
        const result = await (command.execute.length === 4
            ? command.execute(client, message, args, supabase)
            : command.execute(message, args));

      // Send bot reply if any
      if (result?.reply) {
        await message.reply(result.reply);
      }

      // Log command if specified
      if (result?.log) {
        await logCommand(result.log);
      }
    } catch (err) {
      console.error(`❌ Error executing command ${commandName}:`, err);
      message.reply('An error occurred while executing that command.');
    }
  });
}
