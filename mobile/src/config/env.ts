const value = (key: string, candidate: string | undefined) => candidate?.trim() || `missing-${key}`;

export const env = {
  firebase: {
    apiKey: value('firebase-api-key', process.env.EXPO_PUBLIC_FIREBASE_API_KEY),
    authDomain: value('firebase-auth-domain', process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: value('firebase-project-id', process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID),
    storageBucket: value('firebase-storage-bucket', process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: value(
      'firebase-messaging-sender-id',
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    ),
    appId: value('firebase-app-id', process.env.EXPO_PUBLIC_FIREBASE_APP_ID),
  },
  google: {
    webClientId: value('google-web-client-id', process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
    androidClientId: value(
      'google-android-client-id',
      process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    ),
    iosClientId: value('google-ios-client-id', process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
  },
};

export const isFirebaseConfigured =
  /^AIza[0-9A-Za-z_-]{30,}$/.test(env.firebase.apiKey) &&
  /^[a-z0-9.-]+\.firebaseapp\.com$/.test(env.firebase.authDomain) &&
  /^[a-z][a-z0-9-]{4,29}$/.test(env.firebase.projectId) &&
  /^[a-z0-9.-]+\.(appspot\.com|firebasestorage\.app)$/.test(env.firebase.storageBucket) &&
  /^\d{6,20}$/.test(env.firebase.messagingSenderId) &&
  /^1:\d+:web:[0-9A-Za-z_-]+$/.test(env.firebase.appId);

const googleClientIdPattern = /^\d+-[a-z0-9_-]+\.apps\.googleusercontent\.com$/i;

export const isGoogleConfigured = Object.values(env.google).every((entry) =>
  googleClientIdPattern.test(entry),
);

export const missingConfiguration = [
  !isFirebaseConfigured ? 'Firebase (EXPO_PUBLIC_FIREBASE_*)' : null,
  !isGoogleConfigured ? 'Google OAuth (EXPO_PUBLIC_GOOGLE_*_CLIENT_ID)' : null,
].filter((entry): entry is string => Boolean(entry));
