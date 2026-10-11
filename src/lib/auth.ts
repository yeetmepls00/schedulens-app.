// Log in, sign up, and log out with Supabase email + password.
//
// The flow follows the Figma prototype:
//   1.1 Welcome -> Get Started -> 1.4 Sign Up -> 1.5 Terms -> 2.1 Home
//   1.1 Welcome -> I already have an account -> 1.2 Log In -> 2.1 Home
// Welcome shows on first launch only; after that the app opens on Log In
// until you are signed in.
import { getSetting, setSetting } from '../data/db';
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
  const name = (data.user?.user_metadata?.display_name as string | undefined) ?? '';
  if (name && !getSetting('displayName', '')) setSetting('displayName', name);
  setSetting('signedIn', true);
}

/** Creates the account. Returns true when the email still needs confirming. */
export async function signUp(fullName: string, email: string, password: string): Promise<boolean> {
  const { data, error } = await sb().auth.signUp({
    email: email.trim(), password, options: { data: { display_name: fullName.trim() } },
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
  const { error } = await sb().auth.resetPasswordForEmail(email.trim());
  if (error) throw new Error(friendly(error.message));
}

export const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
