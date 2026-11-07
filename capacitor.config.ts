import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.deepchess.app',
  appName: 'DeepChess',
  webDir: 'dist',
  backgroundColor: '#0b0e13',
  android: {
    allowMixedContent: false,
  },
};

export default config;
