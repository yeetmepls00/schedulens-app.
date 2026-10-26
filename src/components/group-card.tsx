// Group cards: the colorful card in the Groups list, and the sheet to change a group's color or photo.
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import { GROUP_THEMES, getGroupLook, setGroupLook } from '../lib/group-look';
import { colors, radius, space } from '../theme/tokens';
import { pickSquareImage } from './avatar';
import { Button, Icon, T } from './ui';

/** Colored (or photo) backdrop shared by the list card and the open group's title card. */
export function GroupBackdrop({ groupId, children, style }: { groupId: string; children: React.ReactNode; style?: object }) {
  const look = getGroupLook(groupId);
  return (
    <LinearGradient colors={look.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[{ borderRadius: 24, overflow: 'hidden' }, style]}>
      {look.photo && (
        <>
          <Image source={{ uri: look.photo }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} resizeMode="cover" accessibilityLabel="Group cover photo" />
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.72)' }} />
        </>
      )}
      {children}
    </LinearGradient>
  );
}

export function MemberBubbles({ names, accent, max = 5 }: { names: string[]; accent: string; max?: number }) {
  const shown = names.slice(0, max);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {shown.map((n, i) => (
        <View key={n + i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999, paddingVertical: 3, paddingLeft: 3, paddingRight: 10 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}>
            <T v="captionStrong" color={colors.white}>{(n || '?')[0].toUpperCase()}</T>
          </View>
          <T v="captionStrong">{n}</T>
        </View>
      ))}
      {names.length > max && <View style={{ backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10, justifyContent: 'center' }}><T v="captionStrong">+{names.length - max}</T></View>}
    </View>
  );
}

/** One group in the Groups list. */
export function GroupListCard({ id, name, description, members, onPress }: { id: string; name: string; description?: string; members?: string[]; onPress: () => void }) {
  const look = getGroupLook(id);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${name}`}>
      <GroupBackdrop groupId={id} style={{ padding: space.lg, gap: space.sm, minHeight: 140, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ width: 52, height: 52, borderRadius: 18, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {look.photo ? <Image source={{ uri: look.photo }} style={{ width: 52, height: 52 }} /> : <Icon name="people" color={look.accent} size={26} />}
          </View>
          <View style={{ flex: 1 }}>
            <T v="section" lines={1}>{name}</T>
            <T v="caption" color={colors.textSecondary}>{members ? `${members.length} ${members.length === 1 ? 'member' : 'members'}` : 'Loading…'}</T>
          </View>
          <Icon name="chevron-forward" color={look.accent} />
        </View>
        {description ? <T lines={2}>{description}</T> : null}
        {members && members.length > 0 && <MemberBubbles names={members} accent={look.accent} />}
      </GroupBackdrop>
    </Pressable>
  );
}

/** Sheet to pick a group's color theme or cover photo (this device only). */
export function GroupLookEditor({ groupId, onClose }: { groupId: string | null; onClose: () => void }) {
  const [error, setError] = useState('');
  const [, bump] = useState(0);
  if (!groupId) return null;
  const look = getGroupLook(groupId);
  async function upload() {
    try { const uri = await pickSquareImage(600); if (uri) { setGroupLook(groupId!, { photo: uri }); bump((n) => n + 1); } }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not use that picture.'); }
  }
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(58,42,44,0.35)', justifyContent: 'flex-end' }} accessibilityLabel="Close">
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.xl, gap: space.md }}>
          <T v="section">Group look</T>
          <T v="caption" color={colors.textSecondary}>Pick a color or a cover photo. This only changes how the group looks on your phone.</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {GROUP_THEMES.map((t) => (
              <Pressable key={t.id} onPress={() => { setGroupLook(groupId, { theme: t.id }); bump((n) => n + 1); }} accessibilityRole="button" accessibilityLabel={`${t.label} color`} accessibilityState={{ selected: look.theme === t.id }}
                style={{ alignItems: 'center', gap: 4, width: 64 }}>
                <LinearGradient colors={t.colors} style={{ width: 48, height: 48, borderRadius: radius.card, borderWidth: look.theme === t.id ? 3 : 1, borderColor: look.theme === t.id ? t.accent : colors.border }} />
                <T v="caption">{t.label}</T>
              </Pressable>
            ))}
          </View>
          {error ? <T v="caption" color={colors.error}>{error}</T> : null}
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button kind="tonal" icon="image-outline" label={look.photo ? 'Change photo' : 'Add cover photo'} style={{ flex: 1 }} onPress={upload} />
            {look.photo && <Button kind="secondary" label="Remove photo" style={{ flex: 1 }} onPress={() => { setGroupLook(groupId, { photo: undefined }); bump((n) => n + 1); }} />}
          </View>
          <Button label="Done" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
