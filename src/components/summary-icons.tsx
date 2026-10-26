// Icons on the Home summary card. Each one can be swapped for another emoji or
// the person's own picture. Saved only on this device, like the profile photo.
import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { getSetting, setSetting } from '../data/db';
import { colors, radius, space } from '../theme/tokens';
import { pickSquareImage } from './avatar';
import { Button, T } from './ui';

export type SlotId = 'mascot' | 'today' | 'busy' | 'left';
/** An emoji, or a picture saved as a data URL. Missing means the default. */
export type SummaryIcon = { emoji: string } | { image: string };

export const SLOT_NAMES: Record<SlotId, string> = { mascot: 'Card mascot', today: 'On today', busy: 'Busy for', left: 'Left to go' };
const DEFAULTS: Record<Exclude<SlotId, 'mascot'>, string> = { today: '🍓', busy: '🍵', left: '🌷' };
const CHOICES = ['🍓', '🍵', '🌷', '🌸', '🍰', '🧁', '🍡', '🍑', '🍒', '🍋', '🥝', '🌼', '🌻', '🍀', '🌈', '⭐', '🌙', '☁️', '🐱', '🐶', '🐰', '🐻', '🐼', '🐸', '🦊', '🐥', '📚', '✏️', '🎀', '💖', '☕', '🎧', '🏀', '🎨', '🎮', '💼'];

export const getSummaryIcons = () => getSetting<Partial<Record<SlotId, SummaryIcon>>>('summaryIcons', {});

/** Draws a slot's icon. `fallback` is used for the mascot, which changes with the time of day. */
export function SummaryGlyph({ slot, size, fallback }: { slot: SlotId; size: number; fallback?: string }) {
  const icon = getSummaryIcons()[slot];
  if (icon && 'image' in icon) return <Image source={{ uri: icon.image }} style={{ width: size * 1.3, height: size * 1.3, borderRadius: size }} accessibilityLabel={`${SLOT_NAMES[slot]} picture`} />;
  const emoji = icon && 'emoji' in icon ? icon.emoji : slot === 'mascot' ? fallback : DEFAULTS[slot];
  return <T style={{ fontSize: size, lineHeight: size * 1.25 }}>{emoji}</T>;
}

/** A sheet to pick an emoji, upload a picture, or go back to the default for one slot. */
export function SummaryIconEditor({ slot, onClose }: { slot: SlotId | null; onClose: () => void }) {
  const [error, setError] = useState('');
  if (!slot) return null;
  const save = (icon: SummaryIcon | undefined) => {
    const all = { ...getSummaryIcons() };
    if (icon) all[slot] = icon; else delete all[slot];
    setSetting('summaryIcons', all);
    setError('');
    onClose();
  };
  async function upload() {
    try { const uri = await pickSquareImage(160); if (uri) save({ image: uri }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not use that picture.'); }
  }
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(58,42,44,0.35)', justifyContent: 'flex-end' }} accessibilityLabel="Close">
        <Pressable onPress={() => {}} style={{ backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: space.xl, gap: space.md, maxHeight: '80%' }}>
          <T v="section">{SLOT_NAMES[slot]}</T>
          <T v="caption" color={colors.textSecondary}>Pick an emoji or use your own picture.</T>
          <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CHOICES.map((e) => (
              <Pressable key={e} onPress={() => save({ emoji: e })} accessibilityRole="button" accessibilityLabel={`Use ${e}`}
                style={{ width: 48, height: 48, borderRadius: radius.button, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' }}>
                <T style={{ fontSize: 26 }}>{e}</T>
              </Pressable>
            ))}
          </ScrollView>
          {error ? <T v="caption" color={colors.error}>{error}</T> : null}
          <Button icon="image-outline" label="Upload a picture" onPress={upload} />
          <View style={{ flexDirection: 'row', gap: space.md }}>
            <Button kind="secondary" label="Use default" style={{ flex: 1 }} onPress={() => save(undefined)} />
            <Button kind="text" label="Close" style={{ flex: 1 }} onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
