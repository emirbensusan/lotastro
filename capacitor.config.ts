import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.0ae5f47c6da64ba78181c7f0648766f6',
  appName: 'lotastro',
  webDir: 'dist',
  server: {
    url: 'https://0ae5f47c-6da6-4ba7-8181-c7f0648766f6.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    Camera: {
      permissions: ['camera']
    }
  }
};

export default config;