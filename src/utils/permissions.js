// src/utils/permissions.js

/**
 * Check if the member has the required role or higher.
 */
export function hasRoleOrHigher(member, roleId) {
  if (!roleId) return false;

  const role = member.guild.roles.cache.get(roleId);
  if (!role) return false;

  const memberHighestPosition = member.roles.highest.position;
  return member.roles.cache.has(roleId) || memberHighestPosition >= role.position;
}

/**
 * Check if member is an admin.
 */
export function isAdmin(member, adminRoleId) {
  return (
    member.permissions.has('ADMINISTRATOR') ||
    hasRoleOrHigher(member, adminRoleId)
  );
}

/**
 * Check if member is a moderator.
 */
export function isModerator(member, modRoleId, adminRoleId) {
  if (isAdmin(member, adminRoleId)) return true;
  return hasRoleOrHigher(member, modRoleId);
}

/**
 * Check if a role can be managed by the member.
 */
export function canManageRole(member, targetRole) {
  return targetRole.position < member.roles.highest.position;
}
