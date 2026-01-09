import { QuestionType } from './index';

export type VocabLevel = 'basic' | 'hard' | 'very_hard' | 'extreme';

export interface VocabLevelInfo {
  level: VocabLevel;
  label: string;
  emoji: string;
  description: string;
  tepsRange: { min: number; max: number };
}

export interface VocabWordInfo {
  word: string;
  level: number;
  cefr: string;
  label: string;
  emoji: string;
  pos: string;
  meaning?: string;
  pronunciation?: string;
  etymology?: string;
  isPhrase?: boolean;
}

export interface PhraseInfo {
  phrase: string;
  meaning?: string;
}

export interface OverviewData {
  totalQuestions: number;
  averageDifficulty: 'high' | 'medium' | 'low';
  directMatchRate: number;
  hardVocabCount: number;

  sourceDistribution: {
    type: 'direct' | 'indirect' | 'external';
    label: string;
    count: number;
    percentage: number;
  }[];

  typeDistribution: {
    type: QuestionType;
    label: string;
    count: number;
    percentage: number;
  }[];

  vocabDistribution: {
    level: VocabLevel;
    label: string;
    emoji: string;
    count: number;
    percentage: number;
  }[];

  vocabList: VocabWordInfo[];
  phraseList?: PhraseInfo[];
}

export interface MetaInsights {
  topVocabulary: {
    rank: number;
    word: string;
    meaning: string;
    level: VocabLevel;
    occurrences: number;
    exampleSentence?: string;
  }[];

  vocabStrategies: {
    strategy: string;
    description: string;
    examples: {
      original: string;
      transformed: string;
    }[];
    frequency: 'high' | 'medium' | 'low';
  }[];

  trapPatterns: {
    pattern: string;
    description: string;
    affectedQuestions: number[];
    avoidanceTip: string;
  }[];

  learningRoadmap: {
    phase: number;
    title: string;
    duration: string;
    tasks: string[];
    focusAreas: string[];
  }[];

  overallComment: string;
}

export interface AnalyzerReport {
  id: string;
  explanation_id: string;

  school_name: string;
  grade: string;
  exam_name: string;
  student_password: string;
  edit_password: string;

  overview_data: OverviewData;
  meta_insights: MetaInsights | null;

  status: 'processing' | 'completed' | 'published' | 'error';
  error_message?: string;

  created_at: string;
  completed_at?: string;
}

export interface CreateAnalyzerReportRequest {
  explanation_id: string;
  student_password: string;
  edit_password: string;
}

export interface AnalyzerReportResponse {
  report: AnalyzerReport;
  explanation: {
    id: string;
    questions: unknown[];
    created_at: string;
  };
}

export interface MetaInsightsInput {
  schoolName: string;
  examName: string;
  grade: string;
  totalQuestions: number;
  questions: {
    number: number;
    type: QuestionType;
    difficulty: 'high' | 'medium' | 'low';
    vocabularyChanges: {
      original: string;
      transformed: string;
      tepsLevel: number;
    }[];
    wrongAnswerPatterns?: string[];
  }[];
  overviewData: OverviewData;
}
