# ScheduLens (mobile app)

ScheduLens is a cross-platform app for Android and iOS. It reads a class schedule from a photo, lets you check every value, keeps your calendar, flags conflicts, and finds free time in a group without revealing what anyone's events are.

## Why this stack

| Part | Choice | Why |
|---|---|---|
| App framework | Expo SDK 57 (React Native, TypeScript) | One codebase runs on Android and iOS, and it has strong beginner documentation. |
| Screens and navigation | Expo Router (`src/app`) | Each file is a screen, so the folder layout is the app map. |
| Local storage | expo-sqlite | Your schedule stays on your phone and works offline. |
| Text reading (OCR) | Google ML Kit (`@react-native-ml-kit/text-recognition`) | Runs on the device for free, so photos are never uploaded. |
| Groups | Supabase (Postgres with row-level security) | Free tier, anonymous sign-in, and database rules that only allow busy times to be stored. |

## Project map

```
src/
  app/                 Screens (one file = one screen)
    (tabs)/            Bottom tabs: Home, Calendar, Scan, Groups, Vault
    verify.tsx         Check extracted events before saving
    review.tsx         Conflict and warning list
    event/[id].tsx     Add or edit one event
    settings.tsx       Name, term dates, warning rules, delete data
  lib/                 Logic with no UI. Tested with `npm test`.
    parser.ts          Turns OCR text into events with confidence levels
    conflicts.ts       Overlap, travel-gap, and workload rules
    freeTime.ts        Group free time from busy blocks only
    ics.ts             Export to any calendar app
    ocr.ts             ML Kit text reading
    groups.ts          Supabase calls
  data/                SQLite storage and React hooks
  components/          Buttons, cards, banners (match the Figma components)
  theme/tokens.ts      Strawberry matcha colors, spacing, type sizes
supabase/schema.sql    Database tables and privacy rules for Groups
```

## Step by step: run it on your phone

1. Install Node.js 20 or newer, and Git.
2. In this folder, run `npm install`.
3. Check the logic works: `npm test` (10 tests should pass) and `npm run typecheck`.
4. Build the development app. ML Kit is native code, so the plain **Expo Go** app cannot read photos. Pick one:
   - **Android, with a USB cable:** install Android Studio, turn on USB debugging on your phone, then run `npx expo run:android`.
   - **Android or iOS, in the cloud:** `npm install -g eas-cli`, `eas login`, `eas build --profile development --platform android` (or `ios`, which needs an Apple Developer account). Install the result on your phone, then run `npx expo start` and scan the QR code.
5. Optional, for Groups: create a free project at supabase.com. In **Authentication > Providers**, turn on **Anonymous sign-ins**. Open the **SQL Editor**, paste `supabase/schema.sql`, and run it. Copy `.env.example` to `.env` and fill in your project URL and anon key from **Project Settings > API**. Restart `npx expo start`.

If you only open the app in Expo Go, everything works except reading photos. The Scan screen will say so, and you can enter events manually.

## What works and what is still a prototype

| Feature | Status |
|---|---|
| Scan or choose a photo, read text on the device | Working (needs a development build) |
| Verify screen with low-confidence and missing values highlighted | Working |
| Manual add, edit, delete events with validation | Working |
| Calendar Day, Week, List, and Heatmap views | Working |
| Overlap, travel-gap, and workload warnings (rule-based, adjustable) | Working |
| Local storage, Vault, delete a file or all data | Working |
| Export to Google Calendar, Apple Calendar, or Outlook through an `.ics` file | Working |
| Groups: create or join by code or QR, busy-time sharing, common free time | Working once Supabase is set up |
| Reading PDFs | Not built. The app asks for a screenshot instead. |
| Direct two-way sync with the phone calendar | Not built. Use the `.ics` export. |
| Home screen widgets | Design only (Figma 2.8) |
| Reminders and notifications | Design only |
| Onboarding screens 1.1 to 1.5 | Design only. Name is set in Settings. |

## Privacy rules built into the code

- Photos are read on the phone and never uploaded.
- Groups receive only day, start time, and end time (`toBusyBlocks` in `src/lib/freeTime.ts`). The database table has no column for titles, rooms, or instructors.
- Database rules let you read busy times only for groups you belong to. Invites expire after 7 days.
- Travel warnings compare the gap between events with a minimum you set. They do not use maps or real distance.
- Workload notes are reminders about long stretches without a break. They are not medical advice.
