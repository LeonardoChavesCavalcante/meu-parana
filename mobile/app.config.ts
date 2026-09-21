import type { ExpoConfig } from 'expo/config';

const config: ExpoConfig = {
  name: 'Meu Paraná',
  slug: 'meu-parana',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon-meu-parana.png',
  // expo-auth-session uses the native application ID for Google's callback.
  // Registering it as the app scheme lets Android return from the browser.
  scheme: 'br.com.meuparana.app',
  userInterfaceStyle: 'light',
  ios: {
    bundleIdentifier: 'br.com.meuparana.app',
    supportsTablet: true,
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'br.com.meuparana.app',
    icon: './assets/icon-meu-parana.png',
    intentFilters: [
      {
        action: 'VIEW',
        category: ['BROWSABLE', 'DEFAULT'],
        data: [{ scheme: 'meuparana' }],
      },
    ],
    adaptiveIcon: {
      backgroundColor: '#075B36',
      foregroundImage: './assets/icon-meu-parana.png',
    },
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/icon-meu-parana.png',
  },
  extra: {
    eas: {
      projectId: '03a03429-9460-4fa6-a25b-64547ab2f317',
    },
  },
  plugins: [
    '@maplibre/maplibre-react-native',
    'expo-sharing',
    'expo-web-browser',
  ],
};

export default config;
