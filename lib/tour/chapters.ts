import type { TourChapter } from './types';

export const USAGE_TOUR_VERSION = 1;

export const TOUR_CHAPTERS: Record<TourChapter['id'], TourChapter> = {
  dashboard: {
    id: 'dashboard',
    label: 'Dashboard',
    steps: [
      { id: 'dashboard-welcome', title: 'Welcome to your AcadeGrade guide', description: 'This guide highlights the real controls as you use the app. You can move back, continue, or skip the guide at any time.' },
      { id: 'dashboard-header', target: 'dashboard-header', title: 'Your academic home', description: 'Your greeting confirms the active profile. Tap the avatar whenever you need your settings, timeline, or account controls.' },
      { id: 'dashboard-performance', target: 'dashboard-performance', title: 'Performance at a glance', description: 'This card combines your cumulative GPA, Performance Index, course count, and latest semester movement.' },
      { id: 'dashboard-stats', target: 'dashboard-stats', title: 'The numbers that matter', description: 'Track courses, earned credits, and courses below the safe score threshold without opening another page.' },
      { id: 'dashboard-recent', target: 'dashboard-recent', title: 'Your latest grades', description: 'Recent scored courses appear here. View All takes you straight to the complete Results timeline.', enterAction: 'dashboard-scroll-recent' },
      { id: 'dashboard-navigation', target: 'nav-results', title: 'Move through your workspace', description: 'Results stores semesters, Insights explains performance, Transcript prepares records, and More opens notifications and settings.', enterAction: 'dashboard-scroll-top' },
    ],
  },
  results: {
    id: 'results',
    label: 'Results Hub',
    steps: [
      { id: 'results-overview', target: 'results-overview', title: 'Your complete results timeline', description: 'CGPA, semester count, credits, and programme progress update automatically from your saved courses.' },
      { id: 'results-create', target: 'results-create', title: 'Create only the correct semester', description: 'AcadeGrade offers the next missing slot from your entry session and programme duration, preventing duplicates and accidental jumps.' },
      { id: 'results-semesters', target: 'results-semesters', title: 'Open a semester workspace', description: 'Expand a semester for a quick course view, or open it to edit courses, scan results, exchange course codes, and mark it complete.', enterAction: 'results-scroll-semesters' },
    ],
  },
  'new-semester': {
    id: 'new-semester',
    label: 'Semester Setup',
    steps: [
      { id: 'semester-plan', target: 'new-semester-plan', title: 'Your programme boundary', description: 'This progress card shows the entry-to-graduation range and how many valid semester slots already exist.' },
      { id: 'semester-next-slot', target: 'new-semester-slot', title: 'The next available slot', description: 'The level, semester, and academic session are selected from your timeline so you do not have to enter them manually.' },
      { id: 'semester-create', target: 'new-semester-create', title: 'Build the workspace', description: 'Create the slot once. AcadeGrade immediately opens its course workspace for you.' },
    ],
  },
  semester: {
    id: 'semester',
    label: 'Semester Workspace',
    steps: [
      { id: 'workspace-summary', target: 'semester-summary', title: 'One semester, one workspace', description: 'The header and summary show this semester’s level, session, GPA, PI, credits, and completion status.' },
      { id: 'workspace-entry', target: 'semester-entry-actions', title: 'Add or scan results', description: 'Use quick course entry for individual records, or keep the live scanner open while AI reads an image or PDF for your review.' },
      { id: 'workspace-code', target: 'semester-code-actions', title: 'Exchange course lists safely', description: 'Import a six-character class code or export your own. Course names and units are shared; private scores are not.' },
      { id: 'workspace-complete', target: 'semester-complete', title: 'Complete when scores are ready', description: 'Completion includes the semester in Dashboard calculations, Insights, and Transcript. Missing scores are checked first.' },
      { id: 'workspace-courses', target: 'semester-courses', title: 'Edit from the course list', description: 'Tap a course to edit it. Delete actions always open a confirmation sheet before anything is removed.', enterAction: 'semester-scroll-courses' },
    ],
  },
  'course-entry': {
    id: 'course-entry',
    label: 'Course Entry',
    steps: [
      { id: 'course-entry-details', target: 'course-entry-details', title: 'Start with the course identity', description: 'Enter the course code and title exactly as they should appear on Results and your transcript.' },
      { id: 'course-entry-units', target: 'course-entry-units', title: 'Choose the correct credit load', description: 'Tap the course credit units. Credits affect both semester GPA and cumulative GPA calculations.' },
      { id: 'course-entry-score', target: 'course-entry-score', title: 'Use the result you have', description: 'Enter a total score for the richest analysis, or switch to Letter Grade when a numerical score is unavailable.' },
      { id: 'course-entry-save', target: 'course-entry-save', title: 'Review, then save', description: 'The live preview shows the calculated grade and grade points. Nothing is added until you tap Save Course.' },
    ],
  },
  'course-code': {
    id: 'course-code',
    label: 'Course Codes',
    steps: [
      { id: 'course-code-purpose', target: 'course-code-header', title: 'Exchange the list, not private results', description: 'Course codes transfer course names and credit units between classmates. Scores, grades, and personal details are never included.' },
      { id: 'course-code-control', target: 'course-code-control', title: 'One short code does the work', description: 'Copy your six-character share code, or enter a classmate\'s code and import. You can still review and edit every imported course afterward.' },
    ],
  },
  scanner: {
    id: 'scanner',
    label: 'Result Scanner',
    steps: [
      { id: 'scanner-frame', target: 'scanner-frame', title: 'Keep the result inside the frame', description: 'Capture a clear, straight image while staying on this page. The moving line shows that the scanner is ready; files count toward the limit only after analysis starts.' },
      { id: 'scanner-sources', target: 'scanner-sources', title: 'Camera, gallery, or document', description: 'Take a live photo, choose an existing image, or import a PDF. Use whichever source gives the clearest course codes and scores.' },
      { id: 'scanner-confirm', target: 'scanner-footer', title: 'Nothing saves without your approval', description: 'AcadeMind presents detected courses for review first. Confirm the values to save, scan again, or switch to manual entry.' },
    ],
  },
  insights: {
    id: 'insights',
    label: 'AI Insights',
    steps: [
      { id: 'insights-tabs', target: 'insights-tabs', title: 'Four ways to understand performance', description: 'Move between Forecast, What-If, Risk, and Written Analysis without leaving the Insights Hub.' },
      { id: 'insights-forecast', target: 'insights-forecast-panel', title: 'Forecast your trajectory', description: 'Compare CGPA or PI trends and projected semesters. Forecasting automatically stops at your graduation boundary.', enterAction: 'insights-show-forecast' },
      { id: 'insights-whatif', target: 'insights-whatif-panel', title: 'Test a target before committing', description: 'Choose a target CGPA, remaining semesters, and expected credit load to see the performance required.', enterAction: 'insights-show-whatif' },
      { id: 'insights-risk', target: 'insights-risk-panel', title: 'Find courses needing attention', description: 'Risk highlights completed courses below 50% and keeps the definition consistent with your Dashboard.', enterAction: 'insights-show-risk' },
      { id: 'insights-written', target: 'insights-written-panel', title: 'Turn results into practical advice', description: 'Written Analysis summarizes strengths, concerns, recommendations, and degree outlook. Its card explains caching and regeneration limits.', enterAction: 'insights-show-analysis' },
    ],
  },
  transcript: {
    id: 'transcript',
    label: 'Transcript',
    steps: [
      { id: 'transcript-heading', target: 'transcript-heading', title: 'Your unofficial academic record', description: 'Only completed semesters are included, keeping shared and exported records consistent.' },
      { id: 'transcript-actions', target: 'transcript-actions', title: 'Export or share securely', description: 'Generate a PDF or create a public link. The photo control lets you choose what appears before sharing.' },
      { id: 'transcript-links', target: 'transcript-links', title: 'You stay in control', description: 'Active links can be copied, shared, or revoked. Deleting a link immediately removes public access.', enterAction: 'transcript-scroll-links' },
      { id: 'transcript-record', target: 'transcript-record', title: 'Review before sending', description: 'Check semester GPAs, cumulative performance, credits, grades, and degree classification in one document.', enterAction: 'transcript-scroll-record' },
    ],
  },
  more: {
    id: 'more',
    label: 'More',
    steps: [
      { id: 'more-destinations', target: 'more-destinations', title: 'Your secondary destinations', description: 'Notifications and Settings live here so the main tab bar stays focused on academic work.' },
      { id: 'more-theme', target: 'more-theme', title: 'Change appearance instantly', description: 'Swipe More upward whenever you want quick Light, Dark, or System appearance controls.', enterAction: 'more-expand' },
    ],
  },
  notifications: {
    id: 'notifications',
    label: 'Notifications',
    steps: [
      { id: 'notifications-header', target: 'notifications-header', title: 'Academic updates in one place', description: 'This inbox holds semester, degree-class, AI insight, and administrator updates.' },
      { id: 'notifications-list', target: 'notifications-list', title: 'Read at your pace', description: 'Tap an unread item to mark it read, or use Mark all read when you have caught up.', enterAction: 'notifications-scroll-list' },
    ],
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    steps: [
      { id: 'settings-profile', target: 'settings-profile', title: 'Keep your identity current', description: 'Your photo, institution, programme, and current level identify the record used throughout AcadeGrade.' },
      { id: 'settings-academic', target: 'settings-academic', title: 'Control your academic experience', description: 'Choose the primary metric and theme, correct programme duration, and manage notification preferences here.', enterAction: 'settings-scroll-academic' },
      { id: 'settings-account', target: 'settings-account', title: 'Exports and account safety', description: 'Export your transcript, sign out securely, or manage account deletion. Destructive actions always require confirmation.', enterAction: 'settings-scroll-account' },
      { id: 'settings-replay', target: 'settings-replay', title: 'The guide is always available', description: 'Replay every usage-tour chapter from the beginning whenever you need a refresher.', enterAction: 'settings-scroll-academic' },
    ],
  },
};

export const ALL_TOUR_CHAPTER_IDS = Object.keys(TOUR_CHAPTERS) as TourChapter['id'][];
