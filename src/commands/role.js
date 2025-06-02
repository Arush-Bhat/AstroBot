// Import necessary utilities and Discord permission flags
import { cmdErrorEmbed, cmdWarningEmbed, cmdResponseEmbed } from '../utils/embeds.js';
import { PermissionsBitField } from 'discord.js';

// Define permission level required to use this command
const permissionLevel = 'Mod';

// Define command metadata
const data = {
  name: 'role',
  description: 'Assign a role to a user. Requires Manage Roles permission.',
  usage: '$role @user @role',
};

// Main command execution function
async function execute(client, message, args, supabase) {
  console.log('✅ Command role.js executed with args:', args);

  // Check if the user has Manage Roles permission
  if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Permission Denied',
            '❌ You need the **Manage Roles** permission to use this command.'
          ),
        ],
      },
    };
  }

  // Ensure both user and role are mentioned
  if (args.length < 2) {
    return {
      reply: {
        embeds: [
          cmdWarningEmbed(
            'Invalid Usage',
            '❗ Please mention both a user and a role.\n\n**Example:** `$role @user @role`'
          ),
        ],
      },
    };
  }

  // Extract user and role mentions
  const userMention = args[0];
  const roleMention = args[1];

  // Clean up mention strings to get raw IDs
  const userId = userMention.replace(/[<@!>]/g, '');
  const roleId = roleMention.replace(/[<@&>]/g, '');

  // Get the corresponding GuildMember and Role objects
  const member = message.guild.members.cache.get(userId);
  const role = message.guild.roles.cache.get(roleId);

  // Validate user existence
  if (!member) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid User',
            '❌ Could not find the specified user.\n\nMake sure to mention them correctly: `$role @user @role`'
          ),
        ],
      },
    };
  }

  // Validate role existence
  if (!role) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Invalid Role',
            '❌ Could not find the specified role.\n\nMake sure to mention the role like: `$role @user @role`'
          ),
        ],
      },
    };
  }

  // Ensure the bot itself has Manage Roles permission
  if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Bot Missing Permission',
            '❌ I need the **Manage Roles** permission to assign roles.'
          ),
        ],
      },
    };
  }

  // Check bot's highest role position relative to the target role
  const botHighest = message.guild.members.me.roles.highest;
  if (role.position >= botHighest.position) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Role Too High',
            '❌ I cannot assign a role that is higher or equal to my highest role.\n\nPlease lower the role’s position in the role settings.'
          ),
        ],
      },
    };
  }

  // Check command executor's highest role position relative to the target role
  const authorHighest = message.member.roles.highest;
  if (role.position >= authorHighest.position) {
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Insufficient Role Power',
            '❌ You cannot assign a role that is higher or equal to your highest role.'
          ),
        ],
      },
    };
  }

  try {
    // Check if the user already has the role
    if (member.roles.cache.has(role.id)) {
      return {
        reply: {
          embeds: [
            cmdWarningEmbed(
              'Role Already Assigned',
              `ℹ️ ${member.user.tag} already has the role **${role.name}**.`
            ),
          ],
        },
      };
    }

    // Assign the role to the user
    await member.roles.add(role);

    // Return success response and log the action
    return {
      reply: {
        embeds: [
          cmdResponseEmbed(
            'Role Assigned',
            `✅ Successfully added **${role.name}** to ${member.user.tag}.`
          ),
        ],
      },
      log: {
        action: 'assignRole',
        targetUserId: member.id,
        targetUserTag: member.user.tag,
        roleId: role.id,
        roleName: role.name,
        moderatorId: message.author.id,
        moderatorTag: message.author.tag,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    // Handle unexpected errors (e.g., Discord API failure)
    console.error('Error adding role:', error);
    return {
      reply: {
        embeds: [
          cmdErrorEmbed(
            'Unexpected Error',
            '❌ Something went wrong while assigning the role.\n\nCheck my permissions and the role hierarchy.'
          ),
        ],
      },
    };
  }
}

// Export the command definition
export default {
  data,
  permissionLevel,
  execute,
};
