// 1.1 Welcome. Shown to everyone who is signed out. Explains what ScheduLens
// does, then leads to Sign Up or Log In (Figma onboarding flow).
import { router } from 'expo-router';
import { View } from 'react-native';
import { Button, Card, Icon, Screen, T, type IconName } from '../components/ui';
import { MAX_FILE_MB } from '../lib/fileCheck';
import { colors, radius, space } from '../theme/tokens';

const STEPS: [IconName, string, string][] = [
  ['cloud-upload-outline', 'Upload or scan', `Choose a photo, screenshot, or PDF of your class schedule (PNG, JPG, or PDF up to ${MAX_FILE_MB} MB).`],
  ['scan-outline', 'We read it', 'ScheduLens finds each subject, day, time, room, and instructor using text recognition in your browser.'],
  ['checkmark-done-outline', 'You check it', 'Anything hard to read is highlighted. Fix mistakes before anything is saved.'],
  ['grid-outline', 'Get your timetable', 'Your classes become a weekly timetable you can edit any time.'],
  ['color-palette-outline', 'Make it yours', 'Pick a design and change colors, days, hours, and what each class shows.'],
  ['download-outline', 'Save or export', 'Your timetable is saved on your device. Export an .ics file for Google, Apple, or Outlook Calendar.'],
];

export default function Welcome() {
  return (
    <Screen>
      <View style={{ alignItems: 'center', gap: space.md, paddingTop: space.xl }}>
        <View style={{ width: 112, height: 112, borderRadius: 28, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="calendar-outline" size={64} color={colors.strawberry} />
        </View>
        <T v="brand" center>ScheduLens</T>
        <T center color={colors.textSecondary}>Snap, stitch, and stay on track.</T>
        <T center>Turn a picture or PDF of your class schedule into an editable digital timetable in a few minutes.</T>
      </View>
      <Button label="Get Started" onPress={() => router.push('/signup')} />
      <Button kind="text" label="I already have an account" onPress={() => router.push('/login')} />

      <T v="section">How it works</T>
      <Card style={{ gap: space.md }}>
        {STEPS.map(([icon, title, text], i) => (
          <View key={title} style={{ flexDirection: 'row', gap: space.md, alignItems: 'flex-start' }}>
            <View style={{ width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.header, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={icon} size={18} color={colors.strawberryStrong} />
            </View>
            <View style={{ flex: 1 }}>
              <T v="label">{i + 1}. {title}</T>
              <T v="caption" color={colors.textSecondary}>{text}</T>
            </View>
          </View>
        ))}
      </Card>

      <T v="section">Timetable designs</T>
      <Card style={{ gap: space.sm }}>
        <T>Five ready-made designs: Minimalist, Pastel, Color-Coded Subjects, Dark Mode, and Planner Style. Preview one before you apply it. Changing the design never changes your classes.</T>
      </Card>

      <T v="section">Your privacy</T>
      <Card style={{ gap: space.sm }}>
        <T>Your schedule file is read inside your browser and is not uploaded. Your classes and timetable are stored on your own device.</T>
        <T color={colors.textSecondary}>Your account (email and username) is kept by our sign-in service so you can log in. If you join a study group, only the times you are busy are shared, never class names, rooms, or instructors.</T>
      </Card>

      <Button kind="tonal" icon="help-circle-outline" label="Read the user manual" onPress={() => router.push('/help')} />
      <Button label="Create an account" onPress={() => router.push('/signup')} />
    </Screen>
  );
}
