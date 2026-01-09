import { VocabLevel, VocabLevelInfo } from '@/types/analyzer';

export const VOCAB_LEVELS: Record<VocabLevel, VocabLevelInfo> = {
  basic: {
    level: 'basic',
    label: '기본',
    emoji: '📗',
    description: '기초 어휘',
    tepsRange: { min: 0, max: 830 },
  },
  hard: {
    level: 'hard',
    label: '내신 기본',
    emoji: '📘',
    description: 'B2 수준, 내신 필수',
    tepsRange: { min: 831, max: 850 },
  },
  very_hard: {
    level: 'very_hard',
    label: '상위권 필수',
    emoji: '📙',
    description: 'C1 수준, 2등급까지 필수',
    tepsRange: { min: 851, max: 870 },
  },
  extreme: {
    level: 'extreme',
    label: '최상위',
    emoji: '📕',
    description: 'C2 수준, 1등급 결정',
    tepsRange: { min: 871, max: 1000 },
  },
};

export function cefrToVocabLevel(cefrLevel: number): VocabLevel {
  if (cefrLevel <= 3.5) return 'basic';
  if (cefrLevel <= 4.5) return 'hard';
  if (cefrLevel <= 5.5) return 'very_hard';
  return 'extreme';
}

export function getVocabLevel(tepsScore: number): VocabLevel {
  if (tepsScore <= 830) return 'basic';
  if (tepsScore <= 850) return 'hard';
  if (tepsScore <= 870) return 'very_hard';
  return 'extreme';
}

export function getVocabLevelInfo(tepsScore: number): VocabLevelInfo {
  return VOCAB_LEVELS[getVocabLevel(tepsScore)];
}
