// Help & user manual. Every button name here matches the app; update this page
// when a feature changes. Opened from Welcome and from Profile & Settings.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Card, Icon, Screen, T } from '../components/ui';
import { MAX_FILE_MB } from '../lib/fileCheck';
import { colors, space } from '../theme/tokens';

interface Section { id: string; title: string; steps?: string[]; text?: string[] }

const SECTIONS: Section[] = [
  { id: 'account', title: '1. Create an account and sign in', steps: [
    'On the Welcome screen, tap Get Started.',
    'Enter a username, your email, and a password with at least 8 characters including a number. Tick the Terms box and tap Sign Up.',
    'Open the email from ScheduLens and tap the confirmation link. The app stays locked until you do; the Terms page then continues by itself.',
    'Next time, tap I already have an account and log in with your email and password.',
    'Forgot your password? On Log In, tap Forgot password?, enter your email, and tap Send reset link. The link in the email opens Choose a new password. Enter it twice and tap Save new password, then log in.',
  ] },
  { id: 'navigate', title: '2. Find your way around', text: [
    'The bar at the bottom has five tabs: Home, Calendar, Scan, Groups, and Vault.',
    'Home shows today’s classes and anything to check today. The bell opens Notifications, and the circle at the top left opens Profile & Settings.',
    'Calendar shows your week as Day, Week, Month, List, or Heatmap. Timetable editor opens the designer.',
    'Vault lists the schedule files you imported. Groups finds free time with classmates.',
  ] },
  { id: 'upload', title: '3. Upload or scan a schedule', steps: [
    'Open the Scan tab and tap Choose an image or PDF.',
    `Pick a PNG, JPG, or PDF file up to ${MAX_FILE_MB} MB. On a phone, the file picker can also take a new photo.`,
    'Wait while ScheduLens reads it. The first scan downloads the text reader (about 12 MB), so it is slower.',
  ], text: [
    'The file is read inside your browser. It is not uploaded to any server.',
    'PDFs with real text are read directly. Scanned PDFs (pictures of pages) are read with OCR, up to 5 pages.',
    'For best results, use a straight, well-lit, uncropped image of the whole table.',
  ] },
  { id: 'review', title: '4. Check what was read and fix mistakes', steps: [
    'Check your schedule shows each class that was found, with the original text under “Read as”.',
    'Yellow or red fields were hard to read or missing. Fix them, and pick the day if asked.',
    'Tap Included to switch a row to Skipped if it is not a class.',
    'Classes already in your calendar are skipped automatically, so importing the same file twice doesn’t add copies.',
    'Tap Save … events. Nothing is added to your calendar before this.',
  ] },
  { id: 'generate', title: '5. Your timetable', text: [
    'After saving, Schedule imported shows how many classes were added. Tap View Calendar to see them, or open Calendar → Timetable editor for the full timetable.',
    'Each class repeats every week on its day.',
  ] },
  { id: 'presets', title: '6. Choose and customize a design', steps: [
    'Open Calendar → Timetable editor and stay on the Design tab.',
    'Tap a preset (Minimalist, Pastel, Color-Coded Subjects, Dark Mode, or Planner Style) to preview it on your timetable.',
    'Tap Apply to use it, or Cancel preview to go back.',
    'Under Customize, change the background, text size, what each class shows, the days and hours shown, and the row height.',
    'Tap Save changes. Reset look changes colors and layout back to the preset. Your classes are never changed by a design.',
  ] },
  { id: 'edit', title: '7. Add and edit classes', steps: [
    'In Timetable editor, tap a class in the timetable (or open the Classes tab and pick one).',
    'Edit the subject, course code, times, room, instructor, and notes. Changes apply when you leave a field or tap Apply changes.',
    'Use Day before / Day after, 15 min earlier / later, Shorter / Longer to move or resize it.',
    'Pick a color for that subject, or tap Duplicate or Delete.',
    'Use the Undo and Redo arrows at the top. Tap Save changes to keep everything, or Cancel to throw the changes away.',
  ], text: ['You can also add a class from Calendar → Add, or Scan → Enter manually, and edit one by tapping it in the Calendar.'] },
  { id: 'save', title: '8. Saving, reopening, and deleting', text: [
    'Your schedule and design are saved in this browser (or on this phone) and are there when you come back on the same device and browser.',
    'ScheduLens keeps one timetable. To copy a class, use Duplicate in the Timetable editor.',
    'To remove an imported schedule, open Vault and tap Delete under the file. Then choose Keep events or Delete events too.',
    'Clearing your browser’s site data removes the saved schedule. Use Data & privacy → Download my data to keep a copy.',
  ] },
  { id: 'overlaps', title: '9. Overlaps and warnings', text: [
    'Classes that overlap are shown side by side with a dashed red border, and a warning explains which ones.',
    'ScheduLens also warns about short gaps between rooms and long stretches without a break. These are simple time rules, not real travel distances or health advice.',
    'Change the limits in Profile & Settings → Schedule rules.',
  ] },
  { id: 'export', title: '10. Export to Google, Apple, or Outlook Calendar', steps: [
    'Open Profile & Settings → Schedule rules and set your Term dates, so weekly classes stop at the end of term. Tap Save settings.',
    'Tap Export to calendar app (.ics) in Vault, Export .ics after an import, or Export .ics file in Data & privacy. A file named schedulens.ics downloads.',
    'Google Calendar (on a computer): Settings → Import & export → Import, choose the file, then Import.',
    'Apple Calendar: open the file and choose a calendar. Outlook: Add calendar → Upload from file.',
  ] },
  { id: 'connect', title: '11. Connecting a calendar account', text: [
    'ScheduLens does not connect to Google, Apple, or Outlook accounts, and does not sync automatically. Export is one-way: a file you import yourself.',
    'If you change your schedule later, export again.',
  ] },
  { id: 'duplicates', title: '12. Avoiding duplicate events after exporting', text: [
    'Tip: in Google Calendar, create a new calendar named ScheduLens and import into it. To update later, delete that calendar and import the new file, so old events don’t pile up.',
  ] },
  { id: 'account-settings', title: '13. Account, privacy, and groups', text: [
    'Profile & Settings: change your username, open Schedule rules, Data & privacy, Timetable editor, or this manual, Log out, or Delete all my data.',
    'Data & privacy: download your data, export your calendar, see group shares, or delete your account.',
    'Groups share only when you are busy. Class names, rooms, and instructors are never shared.',
  ] },
  { id: 'trouble', title: '14. Troubleshooting', text: [
    '“This file type is not supported”: use PNG, JPG, or PDF. iPhone HEIC photos: take a screenshot of the photo first.',
    '“No class times found”: the times must look like 9:00-10:30 AM. Try a sharper image, or add the classes manually.',
    'Wrong day or time: fix it on Check your schedule before saving, or later in the Timetable editor.',
    'The text reader won’t load: check your internet connection. It is only needed the first time.',
    '“Cannot export yet”: set your term dates in Schedule rules.',
    'Reset or confirmation link says it expired: request a new email and use the newest one.',
    'Blank page inside Messenger or Facebook: tap the menu and choose Open in browser.',
  ] },
  { id: 'install', title: '15. Add ScheduLens to your home screen', steps: [
    'Android (Chrome): open Profile & Settings and tap Install ScheduLens, or open the browser menu and tap "Add to Home screen".',
    'iPhone (Safari): tap the Share button, then "Add to Home Screen".',
    'Open ScheduLens from the new icon. It runs full screen, like an app.',
  ] },
];

export default function Help() {
  const [open, setOpen] = useState<string | null>('upload');
  return (
    <Screen title="Help & user manual" back>
      <T color={colors.textSecondary}>How to use every part of ScheduLens, step by step. Tap a topic to open it.</T>
      {SECTIONS.map((s) => {
        const on = open === s.id;
        return (
          <Card key={s.id} style={{ gap: space.sm }}>
            <Pressable onPress={() => setOpen(on ? null : s.id)} accessibilityRole="button" accessibilityState={{ expanded: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 32 }}>
              <T v="cardTitle" style={{ flex: 1 }}>{s.title}</T>
              <Icon name={on ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </Pressable>
            {on && (
              <View style={{ gap: space.sm }}>
                {s.steps?.map((step, i) => (
                  <View key={i} style={{ flexDirection: 'row', gap: space.sm }}>
                    <T v="captionStrong" color={colors.strawberryStrong} style={{ width: 18 }}>{i + 1}.</T>
                    <T style={{ flex: 1 }}>{step}</T>
                  </View>
                ))}
                {s.text?.map((t, i) => <T key={i} color={colors.textSecondary}>{t}</T>)}
              </View>
            )}
          </Card>
        );
      })}
      <T v="caption" color={colors.textSecondary} center>Still stuck? Tell your instructor or the ScheduLens team what you tried and what the screen said.</T>
      <Pressable onPress={() => router.back()}><T v="captionStrong" center color={colors.strawberryStrong}>Back</T></Pressable>
    </Screen>
  );
}
