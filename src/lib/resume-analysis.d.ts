export type ResumeLike = {
  name: string; phone: string; email: string; city: string; targetRole: string;
  summary: string; education: string; experience: string; projects: string; skills: string; importedFile?: string;
};

export type ScoreComponent = { label: string; score: number; max: number; reason: string };
export type ResumeEvaluation = {
  total: number;
  components: ScoreComponent[];
  jdKeywords: string[];
  matchedKeywords: string[];
  missingKeywords: string[];
  missingExperienceSuggestions: { keyword: string; suggestion: string }[];
  suggestions: string[];
};

export function evaluateResume(resume: ResumeLike, jd?: string, role?: string): ResumeEvaluation;
export function extractKeywords(jd?: string, role?: string): string[];
export function tailorResume<T extends ResumeLike>(resume: T, jd?: string, role?: string): T;
