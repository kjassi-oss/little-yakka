import type { CapacitorConfig } from '@capacitor/cli';

// Little Yakka native shell (Capacitor).
//
// The app is a fully server-rendered Next.js app (App Router + /api routes +
// Supabase SSR cookie auth), so it CANNOT be statically bundled. The native
// shell therefore loads the live site remotely via `server.url`. Guideline 4.2
// substance (native push via APNs, Capacitor Haptics, native splash) is layered
// on top so this is more than a wrapped website.
const config: CapacitorConfig = {
  appId: 'com.littleyakka.app',
  appName: 'Little Yakka',
  // Local fallback assets (offline screen). Not the primary content — that's loaded from server.url.
  webDir: 'capacitor-webdir',
  server: {
    url: 'https://www.littleyakka.com',
    // Only allow navigation within our own origins; everything else opens in the system browser.
    allowNavigation: ['www.littleyakka.com', 'littleyakka.com', '*.supabase.co'],
    cleartext: false,
  },
  ios: {
    // Use the device's Safari user-agent so Google OAuth (which blocks embedded webviews)
    // and analytics see a standard browser.
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#334487',
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;
