// Log in, sign up, and log out with Supabase email + password.
//
// The flow follows the Figma prototype:
//   1.1 Welcome -> Get Started -> 1.4 Sign Up -> 1.5 Terms -> 2.1 Home
//   1.1 Welcome -> I already have an account -> 1.2 Log In -> 2.1 Home
// Welcome shows on first launch only; after that the app opens on Log In
// until you are signed in.
import { deleteAllData, getSetting, setSetting } from '../data/db';
import { groupsConfigured, sb } from './groups';

export const authConfigured = groupsConfigured;

/** True once the person has signed up (and accepted the Terms) or logged in. */
export const isSignedIn = () => getSetting('signedIn', false);
/** True once the Welcome screen has been shown, so it only appears on first launch. */
export const hasSeenWelcome = () => getSetting('seenWelcome', false);
export const markWelcomeSeen = () => setSetting('seenWelcome', true);

const friendly = (message: string) =>
  /invalid login credentials/i.test(message) ? 'The email or password is incorrect. Try again or reset your password.'
  : /email not confirmed/i.test(message) ? 'Please confirm your email first. Check your inbox for the link we sent.'
  : /already registered/i.test(message) ? 'An account with this email already exists. Log in instead.'
  : /network|fetch/i.test(message) ? 'Could not reach the server. Check your internet connection.'
  : message;

export async function logIn(email: string, password: string) {
  const { data, error } = await sb().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw new Error(friendly(error.message));
  const name = ((data.user?.user_metadata?.username ?? data.user?.user_metadata?.display_name) as string | undefined) ?? '';
  if (name && !getSetting('displayName', '')) setSetting('displayName', name);
  setSetting('signedIn', true);
}

// Email links (confirm, reset) must point back at the site the person is
// using, not at Supabase's default Site URL.
const webLink = (path: string) =>
  typeof window !== 'undefined' && window.location ? window.location.origin + path : undefined;

/** Creates the account. Returns true when the email still needs confirming. */
export async function signUp(fullName: string, email: string, password: string): Promise<boolean> {
  const { data, error } = await sb().auth.signUp({
    email: email.trim(), password, options: { data: { username: fullName.trim() }, emailRedirectTo: webLink('/login') },
  });
  if (error) throw new Error(friendly(error.message));
  setSetting('displayName', fullName.trim());
  return !data.session;
}

/** Called from 1.5 Terms after the person ticks the box and taps Continue. */
export function acceptTermsAndFinish() {
  setSetting('termsAcceptedAt', new Date().toISOString());
  setSetting('signedIn', true);
}

export async function logOut() {
  try { await sb().auth.signOut(); } finally { setSetting('signedIn', false); }
}

export async function sendPasswordReset(email: string) {
  const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: webLink('/new-password') });
  if (error) throw new Error(friendly(error.message));
}

/** Reads the one-time sign-in from the reset link (in the page address). */
export async function openResetLink() {
  if (typeof window === 'undefined') throw new Error('Open the reset link from your email.');
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const err = hash.get('error_description') ?? query.get('error_description');
  if (err) throw new Error(/expired|invalid/i.test(err) ? 'This reset link has expired or was already used. Request a new one.' : err);
  const code = query.get('code');
  const access = hash.get('access_token'), refresh = hash.get('refresh_token');
  if (code) {
    const { error } = await sb().auth.exchangeCodeForSession(code);
    if (error) throw new Error(friendly(error.message));
  } else if (access && refresh) {
    const { error } = await sb().auth.setSession({ access_token: access, refresh_token: refresh });
    if (error) throw new Error(friendly(error.message));
  } else {
    const { data } = await sb().auth.getSession();
    if (!data.session) throw new Error('This reset link is incomplete. Request a new one.');
  }
  // Remove the one-time tokens from the address bar.
  window.history.replaceState(null, '', window.location.pathname);
}

/** Saves the new password, then signs out so the person logs in with it. */
export async function finishPasswordReset(password: string) {
  const { error } = await sb().auth.updateUser({ password });
  if (error) throw new Error(friendly(error.message));
  await sb().auth.signOut();
  setSetting('signedIn', false);
}

export const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** 4.6 Delete account: removes the online account (and its group data), then this phone's data. */
export async function deleteAccount() {
  const { data } = await sb().auth.getSession();
  const error = data.session ? (await sb().rpc('delete_my_account')).error : null;
  if (error) throw new Error('Could not delete your online account. Check your connection and try again.');
  await sb().auth.signOut().catch(() => {});
  deleteAllData();
}
