export {};

type SearchRequest = {
  roles: string[];
  locations: string[];
  recruitmentTypes: string[];
  keywords?: string[];
};

declare global {
  interface Window {
    jobSecretary?: {
      storage: {
        get<T>(key: string): Promise<T | null>;
        set<T>(key: string, value: T): Promise<void>;
        backup(): Promise<{ canceled: boolean; path?: string }>;
        restore(): Promise<{ canceled: boolean; keys?: string[] }>;
      };
      jobs: {
        search(request: SearchRequest): Promise<{ jobs: unknown[]; reports: unknown[]; searchedAt: string }>;
        addSource(source: { company: string; name: string; url: string; shortName?: string }): Promise<{ count: number }>;
      };
      advisor: {
        run(task: 'questions' | 'answer-analysis' | 'resume-feedback' | 'company-search', payload: Record<string, unknown>): Promise<{ questions?: string[]; text?: string; companies?: unknown[]; searchedAt?: string }>;
      };
      documents: {
        importDocx(): Promise<{ canceled: boolean; name?: string; text?: string }>;
        exportDocx(resume: Record<string, unknown>): Promise<{ canceled: boolean; path?: string }>;
      };
      system: {
        openExternal(url: string): Promise<void>;
        info(): Promise<{ version: string; dataPath: string; platform: string }>;
      };
    };
  }
}
