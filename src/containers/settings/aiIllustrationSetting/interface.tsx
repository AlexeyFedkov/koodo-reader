export interface AIIllustrationSettingProps {
  t: (title: string) => string;
}

export interface AIIllustrationSettingState {
  isEnabled: boolean;
  frequency: 'every-page' | 'every-second-page' | 'every-third-page';
  imageQuality: 'standard' | 'high';
  cacheSize: number;
  showNotifications: boolean;
  isLoading: boolean;
  cacheStats: {
    totalEntries: number;
    estimatedSizeBytes: number;
    memoryHitRate: number;
  } | null;
}