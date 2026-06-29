export interface Task {
  id: string;
  title: string;
  deadline: string; // ISO string containing date and time
  estimatedEffort: number; // in hours
  completed: boolean;
  notes?: string;
  category?: string; // e.g., "Work", "School", "Personal", "Other"
  resourceLink?: string; // URL reference
  createdAt: string;
  lastEditedAt?: string;
  aiAnalysis?: {
    breakdown: string[];
    recommendedNextAction: string;
    suggestedStartTime: string;
    riskLevel: "Low" | "Medium" | "High";
    productivityAdvice: string;
    lastUpdated?: string;
    generatedAt?: string;
  } | null;
  aiFocusPlan?: {
    sessions: {
      sessionNumber: number;
      task: string;
      duration: string;
      goal: string;
      breakDuration: string;
    }[];
    completedSessions?: number[];
    lastUpdated?: string;
    isCustomized?: boolean;
    isDefaultLocal?: boolean;
  } | null;
  storedRisk?: {
    score: number;
    level: "Low" | "Medium" | "High";
    color: string;
    bg: string;
    border: string;
    iconBg: string;
    factors: {
      name: string;
      value: string;
      impact: "low" | "medium" | "high";
      description: string;
    }[];
  };
}

export type CategoryType = "Work" | "School" | "Personal" | "Other";

export interface StatusCounts {
  total: number;
  upcoming: number;
  overdue: number;
  completed: number;
  panic: number; // tasks where buffer is negative or extremely tight
}
