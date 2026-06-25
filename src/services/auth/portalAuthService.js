/**
 * Admin / SubAdmin portal authentication — database tables ONLY.
 * No Supabase Auth, no email, no auth.users.
 *
 * Source of truth:
 *   public.admin_accounts
 *   public.sub_admin_accounts
 */

const PORTAL_SESSION_KEY = 'aiiens_portal_session';
const PORTAL_COOKIE = 'aiiens_portal_session';

export function persistPortalSession({ role, username, accountId }) {
  const payload = JSON.stringify({ role, username, accountId, ts: Date.now() });
  try {
    sessionStorage.setItem(PORTAL_SESSION_KEY, payload);
    document.cookie = `${PORTAL_COOKIE}=${encodeURIComponent(payload)}; path=/; max-age=604800; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function clearPortalSession() {
  try {
    sessionStorage.removeItem(PORTAL_SESSION_KEY);
    document.cookie = `${PORTAL_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function readPortalSessionMarker() {
  try {
    const fromSession = sessionStorage.getItem(PORTAL_SESSION_KEY);
    if (fromSession) return JSON.parse(fromSession);
    const match = document.cookie.match(new RegExp(`${PORTAL_COOKIE}=([^;]+)`));
    if (match?.[1]) return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    /* ignore */
  }
  return null;
}

export function isPortalSessionActive() {
  return Boolean(readPortalSessionMarker());
}

export async function fetchPortalAccount(supabase, role, username) {
  if (!supabase || !username) return null;
  const table = role === 'admin' ? 'admin_accounts' : 'sub_admin_accounts';
  const { data, error } = await supabase.from(table).select('*').eq('username', username).maybeSingle();
  if (error || !data) return null;
  if (data.status && String(data.status).toLowerCase() !== 'active') return null;
  return data;
}

export async function authenticatePortalLogin(supabase, loginType, username, password) {
  if (!supabase) return { error: 'Supabase client not initialized' };
  if (!username || !password) return { error: 'Please fill in all fields' };

  const table = loginType === 'admin' ? 'admin_accounts' : 'sub_admin_accounts';
  const { data, error } = await supabase.from(table).select('*').eq('username', username).maybeSingle();

  if (error) {
    console.warn('[PORTAL AUTH] lookup failed', error.message);
    return { error: 'Invalid Admin or Sub Admin credentials' };
  }
  if (!data) return { error: 'Invalid Admin or Sub Admin credentials' };
  if (data.password !== password) return { error: 'Invalid Admin or Sub Admin credentials' };
  if (data.status && String(data.status).toLowerCase() !== 'active') {
    return { error: 'Account is not active' };
  }

  const role = loginType === 'admin' ? 'admin' : 'subadmin';
  return { account: data, role };
}

export function applyPortalSessionToApp(role, account) {
  window.APP = window.APP || {};
  window.APP.session = true;
  window.APP.portalAuth = true;
  if (role === 'admin') {
    window.APP.role = 'admin';
    window.APP.adminType = 'admin';
    window.APP.user = account;
    window.APP.subAdminData = null;
  } else {
    window.APP.role = 'subadmin';
    window.APP.adminType = 'subadmin';
    window.APP.subAdminData = account;
    window.APP.user = null;
  }
}

export async function restorePortalSession(supabase) {
  const marker = readPortalSessionMarker();
  if (!marker?.username || !marker?.role) return false;

  const account = await fetchPortalAccount(supabase, marker.role, marker.username);
  if (!account) {
    clearPortalSession();
    return false;
  }

  applyPortalSessionToApp(marker.role, account);
  persistPortalSession({
    role: marker.role,
    username: marker.username,
    accountId: account.id,
  });
  return true;
}

export async function fetchSubAdminAccounts(supabase) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('sub_admin_accounts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.warn('[PORTAL AUTH] sub_admin_accounts fetch failed', error.message);
    return [];
  }
  return (data || []).map((row) => ({
    id: row.id,
    username: row.username,
    password: row.password,
    status: row.status || 'active',
    branch: row.branch || '-',
    regulation: row.regulation || '-',
    university: row.university || '-',
    createdAt: row.created_at ? new Date(row.created_at).toLocaleString() : '',
  }));
}
