// Global type declarations for AI Illustration services

declare global {
  interface Window {
    process?: {
      type?: string;
      [key: string]: any;
    };
    require?: (module: string) => any;
    vex?: {
      dialog: {
        buttons: {
          YES: { text: string };
          NO: { text: string };
        };
        prompt: (options: {
          message: string;
          placeholder?: string;
          value?: string;
          callback: (input: string | false) => void;
        }) => void;
      };
    };
    queryLocalFonts?: () => Promise<Array<{
      fullName: string;
      postscriptName: string;
      family: string;
    }>>;
    chatwootSDK?: {
      run: (config: { websiteToken: string; baseUrl: string }) => void;
    };
    $chatwoot?: {
      setLocale: (locale: string) => void;
      setCustomAttributes: (attributes: Record<string, any>) => void;
    };
  }
}

export {};