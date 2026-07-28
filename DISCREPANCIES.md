# Discrepancies found between the handover docs and the actual code

Per the build prompt's own instruction ("flag it, don't silently invent"),
here's everything found while cross-checking `01_CONTEXT.md` / `02_DESIGN.md`
/ `docs/project_handover/2_student_features.md` against the real files in
`acadegrade-fy-project-main.zip`.

## 1. `DELETE /api/user/fcm-token` does not exist

`2_student_features.md` §5 describes FCM token removal on logout as a call
to this route. It's not there — `app/api/user/` on disk contains only
`delete-account/route.ts`. The real web client (`lib/firebase/fcm.ts` on
web, around the logout handler) removes the token with a **direct Firestore
`arrayRemove` update**, no API route involved at all.

**What I did:** ported the real direct-Firestore-write behavior in
`lib/firebase/fcm.ts`, not the documented-but-nonexistent route. If a route
gets added later, this is the one file to update.

## 2. Route count: 17, not 18

`01_CONTEXT.md` says "all 18 API routes already exist." Counting
`app/api/**/route.ts` on disk gives 17. Not a functional issue — just noting
the off-by-one so nobody goes looking for a missing route that was never
there.

## 3. Grade color for "B" — CSS vs. design doc

`02_DESIGN.md` §1 lists the grade colors table without giving B its own
distinct value from the Primary color, but `app/globals.css`'s actual
`--grade-b` custom property is `#818CF8` (the *glow* shade, not `#6366F1`
the primary). I treated the CSS as the source of truth (per `01_CONTEXT.md`
§0: "pull these exactly from `app/globals.css`, do not invent new ones") and
used `#818CF8` for grade B and the 2:1 degree class badge in
`constants/theme.ts`. Worth a quick visual side-by-side against the live
site to confirm this reads as intended on mobile.

## 4. RTDB notification path — inferred, not verified

`01_CONTEXT.md` §5 confirms RTDB is used for notification unread counts but
the zip didn't include an `lib/firebase/rtdb.ts` (or equivalent) to check
the actual path/shape against. `app/(tabs)/profile.tsx`'s `useNotifications`
hook assumes `notifications/{uid}` as a reasonable guess. **This is the one
piece of wiring in this build that's a guess, not a verified port** — flagged
clearly in ARCHITECTURE.md point 3 as well. Please confirm before relying on
it.

## 5. Cloudinary upload preset name for avatars — not in the provided files

The env var list in `01_CONTEXT.md` §8 explicitly says "the preset name
itself isn't in this list — pull it from `lib/` or ask Joshua." The zip's
`lib/utils/constants.ts` only had the cloud name, not the preset. Used a
placeholder (`acadegrade_avatars`) in `profile.tsx` — needs your real preset
name before avatar upload will work.

## 6. `victory-native@41.x` peer-conflicts with Expo SDK 52 — fixed

This one's on me, not a docs/code mismatch — flagging it here anyway since
it's the same "verify, don't assume" discipline as the rest of this file.
`victory-native@41.16+` was rewritten on top of `@shopify/react-native-skia`,
which as of `react-native-skia@2.x` requires React 19. Expo SDK 52 (what
this whole project is built on) ships React 18.3.1. `npm install` correctly
refused to resolve this rather than silently installing a broken pair.

**Fix:** replaced `victory-native` entirely with `components/dashboard/TrendChart.tsx`,
a ~70-line chart built on `react-native-svg` (already a dependency for
`CGPAArc`) — zero new packages, zero peer-dependency surface. Verified by
actually running `npm install --package-lock-only` against the real npm
registry after the fix: resolves clean, 1306 packages, no `ERESOLVE` errors.
The verified `package-lock.json` ships in this zip — use it as-is rather
than deleting it and letting npm re-resolve, to avoid any version drift
between now and whenever you run this.
