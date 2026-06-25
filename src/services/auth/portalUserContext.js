/**
 * Portal user identity for Admin / SubAdmin workspace isolation.
 * Uses account id from admin_accounts / sub_admin_accounts as created_by.
 */

export function getPortalActorId() {
  if (typeof window === 'undefined' || !window.APP) return null;
  if (window.APP.role === 'admin' && window.APP.user?.id) {
    return String(window.APP.user.id);
  }
  if (window.APP.role === 'subadmin' && window.APP.subAdminData?.id) {
    return String(window.APP.subAdminData.id);
  }
  return null;
}

export function getPortalActorUsername() {
  if (typeof window === 'undefined' || !window.APP) return null;
  return window.APP.user?.username || window.APP.subAdminData?.username || null;
}

export function getPortalActorRole() {
  if (typeof window === 'undefined' || !window.APP) return null;
  if (window.APP.role === 'admin') return 'admin';
  if (window.APP.role === 'subadmin') return 'subadmin';
  return null;
}

/** Match created_by against account id (preferred) or legacy username. */
export function isRecordOwner(record) {
  const createdBy = String(record?.created_by ?? '').trim();
  if (!createdBy) return false;

  const actorId = getPortalActorId();
  if (actorId && createdBy === actorId) return true;

  const actorUsername = getPortalActorUsername();
  if (actorUsername && createdBy.toLowerCase() === actorUsername.toLowerCase()) return true;

  return false;
}

export function subjectCreateMeta() {
  const role = getPortalActorRole() || 'subadmin';
  const id = getPortalActorId();
  const username = getPortalActorUsername();
  return {
    created_by: id || username || role,
    created_by_role: role,
  };
}

export function assertRecordOwner(record, action = 'modify') {
  if (isRecordOwner(record)) return null;
  return new Error(`You can only ${action} records you created.`);
}
