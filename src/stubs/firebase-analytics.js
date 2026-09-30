// Stub for firebase/analytics — used only in the web build.
// @capacitor-firebase/analytics lists firebase as an optional peer dep.
// The web path in native-adapter.js uses Google Tag Manager directly,
// so the Firebase Analytics SDK is never actually called on web.
export const getAnalytics = () => ({});
export const logEvent = () => {};
export const setAnalyticsCollectionEnabled = () => {};
export const setConsent = () => {};
export const setUserId = () => {};
export const setUserProperties = () => {};
