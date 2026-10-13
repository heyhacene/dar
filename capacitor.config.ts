import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.otsmane.dar',
  appName: 'Dar',
  webDir: 'public',
  server: {
    url: 'https://dar.otsmane.fr',
    cleartext: false,
    androidScheme: 'https',
  },
  android: {
    allowMixedContent: true,
  },
};

export default config;
