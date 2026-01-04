export interface Report {
  id: string;
  user_id?: string;
  school_name: string;
  grade: string;
  exam_name: string;
  student_password: string;
  edit_password: string;
  vocabulary_level: 'teps_830' | 'teps_850' | 'teps_870';
  status: 'uploading' | 'processing' | 'analyzing' | 'completed' | 'error';
  created_at: string;
  completed_at?: string;
  error_message?: string;
}

export interface UploadedFile {
  id: string;
  report_id: string;
  file_type: 'exam' | 'mock' | 'textbook';
  file_name: string;
  file_url: string;
  file_size: number;
  uploaded_at: string;
}

export interface ExtractedText {
  id: string;
  file_id: string;
  page_number: number;
  extracted_text: string;
  confidence: number;
  extracted_at: string;
}

export interface Question {
  id: string;
  report_id: string;
  question_number: number;
  question_text: string;
  question_type: QuestionType;
  source_type: 'direct' | 'indirect' | 'external';
  source_confidence: number;
  source_file_id?: string;
  source_question_number?: number;
  source_text?: string;
  difficulty: 'high' | 'medium' | 'low';
  analysis?: QuestionAnalysis;
  teacher_comment?: string;
  created_at: string;
}

export type QuestionType =
  | 'purpose'
  | 'mood'
  | 'claim'
  | 'implication'
  | 'gist'
  | 'topic'
  | 'title'
  | 'chart'
  | 'mismatch'
  | 'practical'
  | 'grammar'
  | 'vocabulary'
  | 'blank'
  | 'coherence'
  | 'insertion'
  | 'order'
  | 'summary'
  | 'long_passage'
  | 'other';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  purpose: '목적추론 (18번)',
  mood: '심경추론 (19번)',
  claim: '주장추론 (20번)',
  implication: '함축의미추론 (21번)',
  gist: '요지추론 (22번)',
  topic: '주제추론 (23번)',
  title: '제목추론 (24번)',
  chart: '도표 (25번)',
  mismatch: '내용불일치 (26번)',
  practical: '실용문 (27-28번)',
  grammar: '어법추론 (29번)',
  vocabulary: '어휘추론 (30번)',
  blank: '빈칸추론 (31-34번)',
  coherence: '일관성추론 (35번)',
  insertion: '문장삽입 (36-37번)',
  order: '순서추론 (38-39번)',
  summary: '요약문 (40번)',
  long_passage: '장문독해 (41-42번)',
  other: '기타',
};

export interface QuestionAnalysis {
  vocabulary_changes: VocabularyChange[];
  structure_changes: StructureChange[];
  content_changes: ContentChange[];
  transformation_intent: string[];
  original_question_type?: QuestionType;
  type_changed: boolean;
  external_analysis?: ExternalAnalysis;
}

export interface VocabularyChange {
  original: string;
  transformed: string;
  teps_level: number;
  change_type: 'synonym' | 'paraphrase' | 'technical' | 'academic';
  is_high_difficulty: boolean;
}

export interface StructureChange {
  description: string;
  change_type: 'voice' | 'polarity' | 'connector' | 'tense' | 'sentence_combine' | 'sentence_split' | 'other';
  example?: {
    original: string;
    transformed: string;
  };
}

export interface ContentChange {
  change_type: 'added' | 'deleted' | 'modified' | 'key_sentence_unchanged';
  description: string;
  original_text?: string;
  transformed_text?: string;
  is_answer_key?: boolean;
}

export interface ExternalAnalysis {
  translation: string;
  answer: string;
  answer_reasoning: string;
  wrong_answer_analysis: {
    option: string;
    reason: string;
  }[];
  intent: string;
  learning_strategy: {
    required_vocabulary: { word: string; meaning: string; teps_level: number }[];
    required_grammar: string[];
    study_tips: string[];
  };
}

export interface SummaryReport {
  id: string;
  report_id: string;
  total_questions: number;
  direct_count: number;
  indirect_count: number;
  external_count: number;
  source_distribution: {
    source: string;
    count: number;
    percentage: number;
  }[];
  type_distribution: {
    original_type: QuestionType;
    transformed_type: QuestionType;
    count: number;
  }[];
  overall_difficulty: 'high' | 'medium' | 'low';
  difficulty_analysis: {
    increased: number;
    same: number;
    decreased: number;
    main_factors: string[];
  };
  learning_strategies: LearningStrategy[];
  key_patterns: {
    pattern: string;
    count: number;
    description: string;
  }[];
  high_difficulty_vocabulary: {
    word: string;
    meaning: string;
    teps_level: number;
    occurrence_count: number;
  }[];
  teacher_comment?: string;
  created_at: string;
  updated_at: string;
}

export interface LearningStrategy {
  priority: number;
  title: string;
  description: string;
  details: string[];
}

export interface AnalysisProgress {
  report_id: string;
  current_step: 'ocr' | 'matching' | 'analyzing' | 'generating';
  step_progress: number;
  current_task?: string;
  estimated_remaining_seconds?: number;
  started_at: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface UploadRequest {
  school_name: string;
  grade: string;
  exam_name: string;
  student_password: string;
  edit_password: string;
  vocabulary_level: 'teps_830' | 'teps_850' | 'teps_870';
}

export interface MatchingResult {
  question_number: number;
  source: string;
  source_type: 'direct' | 'indirect' | 'external';
  confidence: number;
  reasoning: string;
  key_matches: string[];
  differences: string[];
}
