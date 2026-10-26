import { router, type Href } from 'expo-router';

/** Go back, or to `fallback` when there is no page to go back to (opened from a link or after a reload). */
export function goBack(fallback: Href = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
