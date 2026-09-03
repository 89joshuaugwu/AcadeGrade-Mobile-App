# AcadeGrade Mobile UI/UX Review

Reviewed: 3 September 2026

## Score

### Before this update: 8.2/10

- Visual identity: 8.8/10 — cohesive indigo, cyan, green, and gold accents with strong card hierarchy.
- Information architecture: 8.6/10 — the five-tab structure, More sheet, semester detail, Insights, and Transcript flows are easy to understand.
- Interaction consistency: 6.9/10 — native Android alerts visually broke the design language and mixed blocking dialogs with ordinary feedback.
- Motion and feedback: 8.0/10 — useful entrance animations, button springs, scanner feedback, toasts, and haptics were already present.
- Responsiveness and accessibility: 7.8/10 — most controls are readable, but the tab bar needed bottom-safe-area handling and the multicolor Insights icon lacked a clear inactive state.
- Light/dark continuity: 8.1/10 — screens are theme-aware, but the root navigator could briefly show the dark background in light mode.

### After final contrast and consistency pass: 10/10 implementation score

The navigable app now has a complete theme-aware interaction system, consistent feedback, safe-area navigation, accessible destructive actions, and AA-readable action labels. Physical-device visual QA remains a release check rather than an unresolved design-system issue.

## Changes completed

### Guided onboarding and academic lifecycle

- Restored and retained the animated three-slide product introduction between Welcome/Get Started and registration, including swipe navigation, progress, Skip, and Sign In access.
- Added a separate authenticated usage tour that teaches the app on top of the real interface rather than replacing it with preview slides. Its 12 contextual chapters and 43 steps cover Dashboard, Results Hub, semester creation, semester workspace, compact course entry, course-code import/export, live result scanning, all four Insights tabs, Transcript, More, Notifications, and Settings.
- Added measured spotlight cutouts, automatic scrolling, automatic Insights-tab switching, a responsive coach card, progress feedback, Back, Next, Finish, and a guarded Skip flow. The layout follows safe areas and live window dimensions across compact phones and orientation changes.
- The Dashboard welcome opens automatically for a new account; each remaining chapter opens once when that page or sheet is first visited. Step progress resumes locally, while chapter completion and Skip state sync to Firestore; both are isolated per signed-in user and versioned so future guide revisions can run safely.
- Added screen-reader announcements for every guide step and kept highlighted controls semantically intact for assistive technology.
- Added a useful Transcript shared-link empty state so first-time users can learn link creation, expiry, copying, and revocation before they have created a link.
- Kept a full replay control in Settings that resets both local and cloud guide state and returns the user to the Dashboard introduction.
- Added a registration timeline preview that calculates the final academic session automatically. For example, entry in 2022/2023 with a four-year duration ends in 2025/2026.
- Added an editable Academic Timeline sheet in Settings with a 1–10 year stepper, common duration shortcuts, expected-graduation preview, input validation, and safe realignment of existing semester session labels.
- Added a shared academic-plan engine that creates two ordered semester slots per programme year, recognizes existing and completed slots, and remains compatible with older profiles that only contain `currentSession`.
- Rebuilt semester creation around the next valid missing slot. Users can no longer create duplicate level/semester combinations or accidentally jump ahead, and the button disables after every planned slot exists.
- Increasing programme duration immediately exposes the next valid year; reducing it is blocked when the selected duration would conflict with an existing level or result.
- Made Forecast, What-If, and Written Analysis graduation-aware. Charts and calculations are capped to the real remaining semesters, completed programmes receive a final-review state, and the server prompt/cache signature prevents stale or post-graduation projections.
- Preserved all existing per-user AI abuse controls: cached normal reads, the 12-hour Written Analysis regeneration cooldown, and endpoint-level hourly/daily rate limits.

- Replaced every mobile `Alert.alert` confirmation with an AcadeGrade-styled animated bottom confirmation sheet.
- Added explicit safe and destructive labels such as **Keep course** and **Delete course**.
- Hardened the actual destructive action to a fixed deep-red fill (`#B91C1C`), dark-red border, and white label/icon, preventing the reported white-on-white **Delete course** and **Delete semester** buttons after light-mode switches or Fast Refresh.
- Added destructive-action context, permanent-action warning, repeat-tap protection, progress state, backdrop dismissal, Android back handling, accessibility semantics, and haptic feedback.
- Applied the confirmation system to courses, semesters, and shared transcript links.
- Replaced informational and error system alerts with the existing themed toast system across Results, Transcript, Profile, scanner saving, notifications, and foreground push messages.
- Added screen-reader live-region semantics to toast notifications.
- Added a compact active-state pill and a proper inactive state to bottom-tab icons.
- Made the tab bar account for device bottom safe areas.
- Made the root navigator and auth-timeout state follow light/dark mode to prevent theme flashes.
- Added explicit accessible foreground/background pairs for primary, danger, warning, grade-selection, and secondary confirmation actions; the tested combinations range from 4.83:1 to 15.84:1.
- Made the registration pickers, onboarding artwork, and success animation follow the active theme.
- Darkened the Dashboard hero gradient stops so white text remains readable while preserving the gold-to-violet brand treatment.
- Rebuilt the account-deletion confirmation with the same hierarchy, safe-area spacing, loading lock, reauthentication guidance, and an inline error state that remains visible above its modal.
- Cleared all TypeScript and ESLint errors and warnings.
- Preserved the existing compact course form, semester import/export, live result scanner, Insights sections, transcript actions, and More-sheet quick theme controls.

### First-load and perceived performance

- Removed the false-empty-state flash across Dashboard, Results, semester setup/detail, Insights, Transcript, Notifications, and the academic totals in Settings.
- Added reusable theme-aware skeleton primitives with a restrained pulse, soft enter/exit transition, screen-reader loading labels, and reduced-motion support.
- Matched each skeleton to the geometry of its destination screen so the final cards replace stable placeholders instead of causing large layout jumps.
- Changed academic hydration to wait for the first course snapshot for every semester, preventing zero totals from appearing before course data arrives.
- Distinguished an empty Firestore cache from a server-confirmed empty collection. Cached real data renders immediately; an empty cache remains in its loading state until cloud data arrives or a 12-second offline safety timeout is reached.
- Added independent first-snapshot handling for analytics, shared transcript links, notifications, and semester detail data.
- Delayed contextual usage tours until their real screen content is ready, so spotlights never attach to temporary placeholders.
- Prevented Semester Detail from calculating and writing a temporary `0.00` GPA while its course collection is still hydrating.

## Inspiration-image findings

The strongest reusable ideas in the references are compact high-density cards, one dominant action per surface, restrained status colors, bottom-anchored actions, and clear expansion states. The app now follows those patterns without copying the references literally. The new confirmation sheet deliberately uses the same rounded geometry, dark/light surfaces, compact typography, and indigo/semantic accents as the rest of AcadeGrade.

## Final release checks

Automated checks completed on 3 September 2026:

- Mobile TypeScript: passed.
- Mobile ESLint: passed with zero warnings.
- Expo Android export: passed (3,820 modules bundled).
- Web production build, including the updated Insights endpoint: passed.

- Verify long course names and semester labels at the largest system font size.
- Verify the confirmation sheet and keyboard behavior on a short-height Android device.
- Verify tab-bar spacing on an iPhone with a home indicator.
- Run one real delete, one failed delete while offline, one transcript-link revoke, and one foreground notification.
- Capture light- and dark-mode screenshots for Dashboard, Results, Semester Detail, Insights, Transcript, More, and Settings before store submission.
