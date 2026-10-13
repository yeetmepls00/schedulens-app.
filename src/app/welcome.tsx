// 1.1 Welcome. Shown to everyone who is signed out: the brand, three short
// slides on what ScheduLens does, and the way into Sign Up or Log In.
// The full walkthrough lives in Help & user manual, so this screen stays short.
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BrandMark } from '../components/brand';
import { Button, Icon, T, type IconName } from '../components/ui';
import { MAX_FILE_MB } from '../lib/fileCheck';
import { colors, radius, space } from '../theme/tokens';

const SLIDES: { icon: IconName; tint: string; fg: string; title: string; text: string; chips: string[] }[] = [
  { icon: 'scan-outline', tint: colors.header, fg: colors.strawberryStrong, title: 'Snap or upload your schedule',
    text: `Choose a photo, screenshot, or PDF (up to ${MAX_FILE_MB} MB). It is read right in your browser.`, chips: ['PNG', 'JPG', 'PDF'] },
  { icon: 'checkmark-done-outline', tint: colors.matchaSoft, fg: colors.matchaStrong, title: 'Check it before it’s saved',
    text: 'Every subject, day, time, and room is shown for review. Anything unclear is highlighted for you.', chips: ['Subjects', 'Times', 'Rooms'] },
  { icon: 'color-palette-outline', tint: '#FBE3B8', fg: colors.warning, title: 'Make the timetable yours',
    text: 'Pick one of five designs, edit any class, and export to Google, Apple, or Outlook Calendar.', chips: ['5 designs', 'Editor', '.ics export'] },
];

export default function Welcome() {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const scroller = useRef<ScrollView>(null);
  const go = (i: number) => { setPage(i); scroller.current?.scrollTo({ x: i * width, animated: true }); };

  return (
    <LinearGradient colors={[colors.gradientTop, colors.gradientMid, colors.gradientBottom]} locations={[0, 0.45, 1]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={{ flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', paddingHorizontal: space.xl, paddingVertical: space.xl, gap: space.xl, justifyContent: 'space-between' }}>
            <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.lg }}>
              <BrandMark size={84} />
              <T v="brand" center style={{ marginTop: space.sm }}>ScheduLens</T>
              <T center color={colors.textSecondary}>Snap, stitch, and stay on track.</T>
            </View>

            <View style={{ gap: space.lg }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
              {width > 0 && (
                <ScrollView ref={scroller} horizontal pagingEnabled showsHorizontalScrollIndicator={false} scrollEventThrottle={16}
                  onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
                  {SLIDES.map((sl) => (
                    <View key={sl.title} style={{ width, alignItems: 'center', gap: space.md, paddingHorizontal: space.sm }}>
                      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: sl.tint, alignItems: 'center', justifyContent: 'center' }}>
                        <Icon name={sl.icon} size={44} color={sl.fg} />
                      </View>
                      <T v="section" center>{sl.title}</T>
                      <T center color={colors.textSecondary} style={{ maxWidth: 320 }}>{sl.text}</T>
                      <View style={{ flexDirection: 'row', gap: space.sm }}>
                        {sl.chips.map((c) => (
                          <View key={c} style={{ paddingHorizontal: space.md, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border }}>
                            <T v="captionStrong" color={sl.fg}>{c}</T>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: space.sm }} accessibilityRole="tablist">
                {SLIDES.map((sl, i) => (
                  <Pressable key={sl.title} onPress={() => go(i)} accessibilityRole="tab" accessibilityLabel={`Slide ${i + 1}: ${sl.title}`} accessibilityState={{ selected: page === i }} hitSlop={10}>
                    <View style={{ width: page === i ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: page === i ? colors.strawberryStrong : colors.strawberrySoft }} />
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={{ gap: space.md }}>
              <Button label="Get Started" onPress={() => router.push('/signup')} />
              <Button kind="secondary" label="I already have an account" onPress={() => router.push('/login')} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: space.xs }}>
                <Icon name="lock-closed-outline" size={14} color={colors.textSecondary} />
                <T v="caption" color={colors.textSecondary}>Your schedule stays on your device.</T>
                <Pressable onPress={() => router.push('/help')} accessibilityRole="link" hitSlop={10}>
                  <T v="captionStrong" color={colors.strawberryStrong}>How it works</T>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}
