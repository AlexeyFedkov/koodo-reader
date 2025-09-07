export interface AIIllustrationSettingsProps {
  t: (title: string) => string;
}

export interface AIIllustrationSettingsState {
  isEnabled: boolean;
  frequency: 'every-page' | 'every-second-page' | 'every-third-page';
  imageQuality: 'standard' | 'high';
  cacheSize: number;
  showNotifications: boolean;
  isLoading: boolean;
  apiKey: string;
  isApiKeyVisible: boolean;
  cacheStats: {
    totalEntries: number;
    estimatedSizeBytes: number;
    memoryHitRate: number;
  } | null;
}