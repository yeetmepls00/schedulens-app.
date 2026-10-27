// Log in, sign up, and log out with Supabase email + password.
//
// The flow follows the Figma prototype:
//   1.1 Welcome -> Get Started -> 1.4 Sign Up -> 1.5 Terms -> 2.1 Home
//   1.1 Welcome -> I already have an account -> 1.2 Log In -> 2.1 Home
//
// Nothing past Welcome/Log In/Sign Up opens until the account's email is
// confirmed. The check uses the Supabase session itself (not a saved flag),
// and the database refuses group requests from unconfirmed accounts.
import type { Session } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { deleteAllData, getSetting, setSetting } from '../data/db';
import { groupsConfigured, sb } from './groups';

export const authConfigured = groupsConfigured;

// --- Who is signed in --------------------------------------------------------
let verified = false;
const listeners = new Set<() => void>();
const isConfirmed = (s: Session | null) => !!s?.user.email_confirmed_at && !s.user.is_anonymous;
function setVerified(v: boolean) {
  if (v === verified) return;
  verified = v;
  listeners.forEach((l) => l());
}

/** Reads the saved session once at startup and keeps watching it. */
export async function loadAuth() {
  if (!authConfigured) return;
  try {
    const { data } = await sb().auth.getSession();
    setVerified(isConfirmed(data.session));
  } catch { setVerified(false); }
  sb().auth.onAuthStateChange((_event, session) => setVerified(isConfirmed(session)));
}

/** True only with a confirmed-email session and the Terms accepted. */
export const isSignedIn = () => verified && getSetting('signedIn', false);
/** True when the session's email is confirmed (Terms may still be open). */
export const isVerified = () => verified;
export const useSignedIn = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, isSignedIn);
export const useVerified = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, isVerified);

// --- Where to go after signing in ---------------------------------------------
// The page someone tried to open before signing in, kept for this browser tab.
const NEXT_KEY = 'schedulens-next';
const PUBLIC = ['/welcome', '/login', '/signup', '/terms', '/reset-password', '/new-password', '/help', '/confirmed'];
export const isPublicPath = (path: string) => PUBLIC.includes(path);
const session = () => (Platform.OS === 'web' && typeof sessionStorage !== 'undefined' ? sessionStorage : null);
export function rememberNext(path: string) {
  if (!path.startsWith('/') || path.startsWith('//') || isPublicPath(path.split('?')[0]) || path === '/') return;
  try { session()?.setItem(NEXT_KEY, path); } catch { /* storage blocked */ }
}
/** The page to open after sign-in (only paths inside this app). */
export function takeNext(fallback = '/'): string {
  try {
    const s = session(); const v = s?.getItem(NEXT_KEY); s?.removeItem(NEXT_KEY);
    return v && v.startsWith('/') && !v.startsWith('//') ? v : fallback;
  } catch { return fallback; }
}
const peekNext = () => { try { return session()?.getItem(NEXT_KEY) ?? null; } catch { return null; } };
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
  if (!isConfirmed(data.session)) {
    await sb().auth.signOut().catch(() => {});
    throw new Error(friendly('Email not confirmed'));
  }
  const name = ((data.user?.user_metadata?.username ?? data.user?.user_metadata?.display_name) as string | undefined) ?? '';
  if (name && !getSetting('displayName', '')) setSetting('displayName', name);
  // Logging in on a new device still needs the Terms once.
  if (getSetting('termsAcceptedAt', '')) setSetting('signedIn', true);
  setVerified(true);
  return !!getSetting('termsAcceptedAt', '');
}

// Email links (confirm, reset) must point back at the site the person is
// using, not at Supabase's default Site URL.
const webLink = (path: string) =>
  typeof window !== 'undefined' && window.location ? window.location.origin + path : undefined;

// Kept in memory only (never saved) so this tab can notice when the email is
// confirmed and sign in by itself.
let pending: { email: string; password: string } | null = null;
export const hasPendingSignUp = () => !!pending;
export const pendingEmail = () => pending?.email ?? '';

/** Creates the account. Returns true when the email still needs confirming. */
export async function signUp(fullName: string, email: string, password: string): Promise<boolean> {
  const next = peekNext();
  const { data, error } = await sb().auth.signUp({
    email: email.trim(), password,
    options: { data: { username: fullName.trim() }, emailRedirectTo: webLink('/confirmed' + (next ? `?next=${encodeURIComponent(next)}` : '')) },
  });
  if (error) throw new Error(friendly(error.message));
  // Supabase returns a user with no identities when the email is already registered.
  if (data.user && data.user.identities?.length === 0) throw new Error(friendly('already registered'));
  setSetting('displayName', fullName.trim());
  pending = { email: email.trim(), password };
  setVerified(isConfirmed(data.session));
  return !isConfirmed(data.session);
}

/** Tries to sign in with the details just used to sign up. True once the email is confirmed. */
export async function checkConfirmed(): Promise<boolean> {
  if (verified) return true;
  if (!pending) return false;
  const { data, error } = await sb().auth.signInWithPassword(pending);
  if (error || !isConfirmed(data.session)) return false;
  pending = null;
  setVerified(true);
  return true;
}

/** Confirms the email with the 6-digit code from the email, without leaving this page. */
export async function confirmWithCode(code: string): Promise<void> {
  if (!pending) throw new Error('Log in to get a new confirmation email.');
  const { data, error } = await sb().auth.verifyOtp({ email: pending.email, token: code.replace(/\D/g, ''), type: 'signup' });
  if (error) throw new Error(/expired|invalid/i.test(error.message) ? 'That code is wrong or has expired. Check the email or tap Resend email.' : friendly(error.message));
  if (!isConfirmed(data.session)) throw new Error('Could not confirm yet. Try again.');
  pending = null;
  setVerified(true);
}

export async function resendConfirmation() {
  if (!pending) throw new Error('Log in to get a new confirmation email.');
  const next = peekNext();
  const { error } = await sb().auth.resend({ type: 'signup', email: pending.email,
    options: { emailRedirectTo: webLink('/confirmed' + (next ? `?next=${encodeURIComponent(next)}` : '')) } });
  if (error) throw new Error(friendly(error.message));
}

/** Called from 1.5 Terms after the person ticks the box and taps Continue. Needs a confirmed email. */
export function acceptTermsAndFinish() {
  if (!verified) throw new Error('Please confirm your email first. Check your inbox for the link we sent.');
  setSetting('termsAcceptedAt', new Date().toISOString());
  setSetting('signedIn', true);
  listeners.forEach((l) => l());
}

/** Opens the sign-in from a confirmation link (code or tokens in the address). */
export async function openConfirmLink() {
  if (typeof window === 'undefined') return;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const err = hash.get('error_description') ?? query.get('error_description');
  if (err) throw new Error(/expired|invalid/i.test(err) ? 'This confirmation link has expired or was already used. Log in to get a new one.' : err);
  const code = query.get('code');
  const access = hash.get('access_token'), refresh = hash.get('refresh_token');
  const res = code ? await sb().auth.exchangeCodeForSession(code)
    : access && refresh ? await sb().auth.setSession({ access_token: access, refresh_token: refresh })
    : await sb().auth.getSession();
  if (res.error) throw new Error(friendly(res.error.message));
  if (!isConfirmed(res.data.session)) throw new Error('This confirmation link is incomplete. Log in to get a new one.');
  setVerified(true);
}

export async function logOut() {
  pending = null;
  try { await sb().auth.signOut(); } finally { setSetting('signedIn', false); setVerified(false); }
}

export async function sendPasswordReset(email: string) {
  const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: webLink('/new-password') });
  if (error) throw new Error(friendly(error.message));
}

let savedLink: { hash: string; search: string } | null = null;
/** Keeps the reset link's details when it lands on another page first. */
export function rememberResetLink(hash: string, search: string) { savedLink = { hash, search }; }

/** Reads the one-time sign-in from the reset link (in the page address). */
export async function openResetLink() {
  if (typeof window === 'undefined') throw new Error('Open the reset link from your email.');
  const src = savedLink ?? { hash: window.location.hash, search: window.location.search };
  savedLink = null;
  const hash = new URLSearchParams(src.hash.replace(/^#/, ''));
  const query = new URLSearchParams(src.search);
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
  setVerified(false);
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
