// src/utils/permissions.js

/**
 * Check if the member has the required role or higher.
 * 
 * @param {GuildMember} member - The member to check
 * @param {string} roleId - The role ID to compare against
 * @returns {boolean} - True if member has the role or a higher one
 */
function hasRoleOrHigher(member, roleId) {
  if (!roleId) return false;

  const role = member.guild.roles.cache.get(roleId);
  if (!role) return false;

  // Member's highest role position
  const memberHighestPosition = member.roles.highest.position;

  // Return true if the member has the role or any role higher or equal to the role
  return member.roles.cache.has(roleId) || memberHighestPosition >= role.position;
}

/**
 * Check if member is an admin.
 * 
 * @param {GuildMember} member
 * @param {string} adminRoleId
 * @returns {boolean}
 */
function isAdmin(member, adminRoleId) {
  return (
    member.permissions.has('ADMINISTRATOR') ||
    hasRoleOrHigher(member, adminRoleId)
  );
}

/**
 * Check if member is a moderator.
 * 
 * @param {GuildMember} member
 * @param {string} modRoleId
 * @param {string} adminRoleId
 * @returns {boolean}
 */
function isModerator(member, modRoleId, adminRoleId) {
  if (isAdmin(member, adminRoleId)) return true;
  return hasRoleOrHigher(member, modRoleId);
}

/**
 * Check if a role can be managed by the member (for role and derole commands).
 * The member can manage only roles strictly lower than their highest role.
 * 
 * @param {GuildMember} member
 * @param {Role} targetRole
 * @returns {boolean}
 */
function canManageRole(member, targetRole) {
  return targetRole.position < member.roles.highest.position;
}

export default {
  hasRoleOrHigher,
  isAdmin,
  isModerator,
  canManageRole,
};
