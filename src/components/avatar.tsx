// Profile photo. Saved only on this device (never uploaded), like the rest of the personal data.
import * as ImagePicker from 'expo-image-picker';
import { Image, Platform, View } from 'react-native';
import { getSetting, setSetting } from '../data/db';
import { colors, radius } from '../theme/tokens';
import { Icon, T } from './ui';

export const getAvatar = () => getSetting<string>('avatar', '');

/** Shrinks a picked web image to a small square JPEG so it stays light in storage. */
function shrink(uri: string, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = size; c.height = size;
      const s = Math.min(img.width, img.height);
      c.getContext('2d')!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('That file is not a picture we can use.'));
    img.src = uri;
  });
}

/** Lets the person choose a square photo. Returns null if they cancelled. */
export async function pickSquareImage(size = 256): Promise<string | null> {
  const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
  if (r.canceled || !r.assets?.[0]) return null;
  return Platform.OS === 'web' ? shrink(r.assets[0].uri, size) : r.assets[0].uri;
}

/** Lets the person choose a photo. Returns false if they cancelled. */
export async function pickAvatar(): Promise<boolean> {
  const uri = await pickSquareImage();
  if (!uri) return false;
  setSetting('avatar', uri);
  return true;
}
export const removeAvatar = () => setSetting('avatar', '');

export function Avatar({ size = 48, name = '' }: { size?: number; name?: string }) {
  const uri = getAvatar();
  const initials = name.trim().split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 2, borderColor: colors.strawberry, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {uri ? <Image source={{ uri }} style={{ width: size, height: size }} accessibilityLabel="Profile photo" />
        : initials ? <T v="cardTitle" color={colors.strawberryStrong}>{initials}</T>
        : <Icon name="person" color={colors.strawberryStrong} />}
    </View>
  );
}
