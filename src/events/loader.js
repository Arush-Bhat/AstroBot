import { readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function setupHandlers(client) {
  // === Load Event Handlers Dynamically ===
  const eventsPath = path.join(__dirname);
  const eventFiles = readdirSync(eventsPath).filter(file => file.endsWith('.js') && file !== 'loader.js');

  for (const file of eventFiles) {
    try {
      const event = await import(`./${file}`);
      const eventName = file.split('.')[0];

      if (typeof event.default !== 'function') {
        console.error(`❌ Event file "${file}" does not export a default function`);
        continue;
      }

      client.on(eventName, (...args) => event.default(...args, client));
      console.log(`✅ Loaded event: ${eventName}`);
    } catch (err) {
      console.error(`❌ Failed to load event "${file}":`, err);
    }
  }

  // === Load Commands ===
  client.commands = new Map();
  const commandsPath = path.join(__dirname, '..', 'commands');
  const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

  for (const file of commandFiles) {
    try {
      const command = await import(`../commands/${file}`);
      const commandName = command.default.data?.name;

      if (!commandName) {
        console.warn(`⚠️ Command file "${file}" is missing 'data.name'`);
        continue;
      }

      client.commands.set(commandName, command.default);
      console.log(`📦 Loaded command: ${commandName}`);
    } catch (err) {
      console.error(`❌ Failed to load command "${file}":`, err);
    }
  }
}
