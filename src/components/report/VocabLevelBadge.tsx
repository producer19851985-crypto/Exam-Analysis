'use client';

import { VocabLevel } from '@/types/analyzer';
import { VOCAB_LEVELS } from '@/constants/vocabulary';

interface VocabLevelBadgeProps {
  level: VocabLevel;
  showDescription?: boolean;
}

export function VocabLevelBadge({ level, showDescription = false }: VocabLevelBadgeProps) {
  const info = VOCAB_LEVELS[level];
  
  const colorMap: Record<VocabLevel, string> = {
    basic: 'bg-green-100 text-green-700 border-green-200',
    hard: 'bg-blue-100 text-blue-700 border-blue-200',
    very_hard: 'bg-orange-100 text-orange-700 border-orange-200',
    extreme: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${colorMap[level]}`}>
      <span>{info.emoji}</span>
      <span>{info.label}</span>
      {showDescription && <span className="text-[10px] opacity-70">({info.description})</span>}
    </span>
  );
}
