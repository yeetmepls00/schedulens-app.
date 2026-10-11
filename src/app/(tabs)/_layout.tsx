// Bottom navigation. The order never changes: Home, Calendar, Scan (center), Groups, Vault.
import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../components/ui';
import { colors, type } from '../../theme/tokens';

const TABS: { name: string; label: string; icon: IconName; iconOn: IconName }[] = [
  { name: 'index', label: 'Home', icon: 'home-outline', iconOn: 'home' },
  { name: 'calendar', label: 'Calendar', icon: 'calendar-outline', iconOn: 'calendar' },
  { name: 'scan', label: 'Scan', icon: 'camera-outline', iconOn: 'camera' },
  { name: 'groups', label: 'Groups', icon: 'people-outline', iconOn: 'people' },
  { name: 'vault', label: 'Vault', icon: 'folder-outline', iconOn: 'folder' },
];

function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 12), paddingHorizontal: 8, shadowColor: '#B8324B', shadowOpacity: 0.12, shadowRadius: 16, elevation: 12 }}>
      {TABS.map((t, i) => {
        const on = state.index === i;
        const go = () => navigation.navigate(t.name);
        if (t.name === 'scan') {
          return (
            <Pressable key={t.name} onPress={go} accessibilityRole="button" accessibilityLabel="Scan or add a schedule" style={{ flex: 1, alignItems: 'center', marginTop: -28 }}>
              <View style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: colors.strawberryStrong, borderWidth: 4, borderColor: colors.white, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="camera" size={28} color={colors.onAccent} />
              </View>
              <Text style={[on ? type.captionStrong : type.caption, { color: on ? colors.strawberryStrong : colors.textSecondary }]}>Scan</Text>
            </Pressable>
          );
        }
        return (
          <Pressable key={t.name} onPress={go} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={t.label} style={{ flex: 1, alignItems: 'center', gap: 4, minHeight: 48 }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 4, borderRadius: 999, backgroundColor: on ? colors.matchaSoft : 'transparent' }}>
              <Icon name={on ? t.iconOn : t.icon} color={on ? colors.strawberryStrong : colors.textSecondary} />
            </View>
            <Text style={[on ? type.captionStrong : type.caption, { color: on ? colors.strawberryStrong : colors.textSecondary }]}>{t.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}


export default function TabsLayout() {
  return (
    <Tabs tabBar={(p) => <TabBar {...p} />} screenOptions={{ headerShown: false }}>
      {TABS.map((t) => <Tabs.Screen key={t.name} name={t.name} />)}
    </Tabs>
  );
}