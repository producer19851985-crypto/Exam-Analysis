import { OverviewData, VocabLevel, VocabWordInfo, PhraseInfo } from '@/types/analyzer';
import { QuestionType, QUESTION_TYPE_LABELS } from '@/types/index';
import { VOCAB_LEVELS, cefrToVocabLevel } from '@/constants/vocabulary';
import { getWordLevel, getDetailedWordInfo, WordLevel, DetailedWordInfo } from './cefr';
import aclData from '@/data/acl-cleaned.json';

const ACL_BY_FIRST_WORD: Map<string, string[]> = new Map();
for (const collocation of aclData as string[]) {
  const firstWord = collocation.split(' ')[0];
  if (!ACL_BY_FIRST_WORD.has(firstWord)) {
    ACL_BY_FIRST_WORD.set(firstWord, []);
  }
  ACL_BY_FIRST_WORD.get(firstWord)!.push(collocation);
}

interface ExplanationQuestion {
  questionNumber: number;
  questionType: string;
  difficulty: 'high' | 'medium' | 'low';
  keyVocabulary?: Array<{
    word: string;
    meaning: string;
    tepsLevel?: number;
  }>;
  sourceType?: 'direct' | 'indirect' | 'external';
}

interface OcrQuestion {
  number?: number;
  text?: string;
  type?: string;
  answer?: string;
}

const EXCLUDED_WORDS = new Set([
  'the', 'and', 'that', 'this', 'with', 'from', 'have', 'been', 'were', 'are',
  'was', 'his', 'her', 'their', 'they', 'them', 'she', 'him', 'its', 'you', 'your',
  'which', 'what', 'when', 'where', 'who', 'how', 'why', 'would', 'could',
  'should', 'will', 'shall', 'may', 'might', 'must', 'being', 'having',
  'did', 'does', 'done', 'doing', 'had', 'has', 'got', 'get', 'getting',
  'also', 'just', 'only', 'even', 'still', 'already', 'almost', 'always',
  'very', 'much', 'more', 'most', 'many', 'some', 'any', 'all', 'both',
  'each', 'every', 'other', 'another', 'such', 'same',
  'than', 'then', 'there', 'here', 'however', 'therefore', 'because',
  'although', 'though', 'while', 'unless', 'until', 'since', 'whether',
  'not', 'but', 'yet', 'for', 'nor', 'per', 'via', 'out', 'off',
]);

const CURATED_PHRASES = new Set([
  'at a cost of', 'at the cost of', 'at the expense of', 'at the risk of',
  'at a loss', 'at a glance', 'at any rate', 'at all costs',
  'in exchange for', 'in terms of', 'in favor of', 'in light of',
  'in spite of', 'in case of', 'in place of', 'in search of',
  'in the absence of', 'in the face of', 'in the midst of',
  'in addition to', 'in contrast to', 'in response to', 'in relation to',
  'by means of', 'by virtue of', 'by way of', 'by dint of',
  'for the sake of', 'for fear of', 'for lack of', 'for want of',
  'on behalf of', 'on account of', 'on the verge of', 'on the basis of',
  'with a view to', 'with regard to', 'with respect to', 'with reference to',
  'as a result of', 'as opposed to', 'as a consequence of',
  'regardless of', 'irrespective of', 'devoid of', 'bereft of',
  'refrain from', 'abstain from', 'stem from', 'derive from', 'result from',
  'engage in', 'result in', 'consist of', 'account for',
  'give rise to', 'give way to', 'take advantage of', 'take account of',
  'make use of', 'make room for', 'make way for',
  'be capable of', 'be aware of', 'be conscious of', 'be indicative of',
  'be subject to', 'be prone to', 'be liable to', 'be inclined to',
  'be attributed to', 'be confined to', 'be dedicated to', 'be exposed to',
  'contrary to', 'prior to', 'subsequent to', 'due to', 'owing to',
  'thanks to', 'according to', 'compared to', 'related to',
]);

const PHRASE_PATTERNS = [
  /^at\s+(a|the)\s+\w+\s+of\b/i,
  /^in\s+(the\s+)?\w+\s+(of|to|for)\b/i,
  /^by\s+(means|virtue|way|dint)\s+of\b/i,
  /^for\s+(the\s+)?(sake|fear|lack|want)\s+of\b/i,
  /^on\s+(the\s+)?(behalf|account|verge|basis)\s+of\b/i,
  /^with\s+(a\s+)?(view|regard|respect|reference)\s+to\b/i,
  /^as\s+(a\s+)?(result|consequence|opposed)\s+(of|to)\b/i,
  /^(regardless|irrespective|devoid|bereft)\s+of\b/i,
];

function findAclCollocations(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/);
  const found: string[] = [];
  
  for (const word of words) {
    const candidates = ACL_BY_FIRST_WORD.get(word);
    if (!candidates) continue;
    
    for (const collocation of candidates) {
      if (text.toLowerCase().includes(collocation)) {
        found.push(collocation);
      }
    }
  }
  
  return found;
}

function isLikelyProperNoun(word: string, originalText: string): boolean {
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  const matches = originalText.match(regex) || [];
  const capitalizedCount = matches.filter(m => m[0] === m[0].toUpperCase()).length;
  return capitalizedCount > matches.length / 2;
}

function extractEnglishWords(text: string): { word: string; isProperNoun: boolean }[] {
  const words = text.match(/[a-zA-Z]{3,}/g) || [];
  const seen = new Set<string>();
  const result: { word: string; isProperNoun: boolean }[] = [];
  
  for (const word of words) {
    const lower = word.toLowerCase();
    if (seen.has(lower)) continue;
    if (EXCLUDED_WORDS.has(lower)) continue;
    if (lower.length < 4) continue;
    
    seen.add(lower);
    result.push({
      word: lower,
      isProperNoun: isLikelyProperNoun(lower, text),
    });
  }
  
  return result;
}

function extractHighlightedVocabulary(text: string, questionType: string = ''): string[] {
  const extracted: string[] = [];
  let match;
  
  const boldPattern = /\*\*([a-zA-Z][a-zA-Z\s'-]*?)\*\*/g;
  while ((match = boldPattern.exec(text)) !== null) {
    const word = match[1].trim().toLowerCase();
    if (word.length >= 3 && !EXCLUDED_WORDS.has(word)) {
      extracted.push(word);
    }
  }
  
  const abPattern = /\([A-Z]\)\s*([a-zA-Z][a-zA-Z\s'-]*?)(?=\s*\([A-Z]\)|\s*\n|\s*$)/g;
  while ((match = abPattern.exec(text)) !== null) {
    const phrase = match[1].trim().toLowerCase();
    if (phrase.length >= 3) {
      extracted.push(phrase);
    }
  }
  
  const singleChoicePattern = /[①②③④⑤]\s+([a-zA-Z][a-zA-Z-]*?)(?=\s*[①②③④⑤]|\s*\n|\s*$)/g;
  while ((match = singleChoicePattern.exec(text)) !== null) {
    const word = match[1].trim().toLowerCase();
    if (word.length >= 3 && !EXCLUDED_WORDS.has(word)) {
      extracted.push(word);
    }
  }
  
  if (questionType.includes('빈칸')) {
    const choicePattern = /[①②③④⑤]\s*([a-zA-Z][a-zA-Z\s',-]{3,50})/g;
    while ((match = choicePattern.exec(text)) !== null) {
      const choiceText = match[1].trim().toLowerCase();
      
      for (const phrase of CURATED_PHRASES) {
        if (choiceText.includes(phrase)) {
          extracted.push(phrase);
        }
      }
      
      const aclMatches = findAclCollocations(choiceText);
      for (const aclPhrase of aclMatches) {
        if (!extracted.includes(aclPhrase)) {
          extracted.push(aclPhrase);
        }
      }
      
      for (const pattern of PHRASE_PATTERNS) {
        const phraseMatch = choiceText.match(pattern);
        if (phraseMatch && !extracted.includes(phraseMatch[0].toLowerCase())) {
          extracted.push(phraseMatch[0].toLowerCase());
        }
      }
    }
  }
  
  return extracted;
}

function analyzeHighlightedVocabulary(ocrQuestions: OcrQuestion[]): {
  vocabLevelCounts: Record<VocabLevel, number>;
  hardVocabCount: number;
  vocabList: VocabWordInfo[];
  phraseList: PhraseInfo[];
} {
  const vocabLevelCounts: Record<VocabLevel, number> = {
    basic: 0,
    hard: 0,
    very_hard: 0,
    extreme: 0,
  };
  let hardVocabCount = 0;
  const vocabList: VocabWordInfo[] = [];
  const phraseList: PhraseInfo[] = [];
  const processedWords = new Set<string>();
  const processedPhrases = new Set<string>();

  for (const q of ocrQuestions) {
    const text = q.text || '';
    const highlightedItems = extractHighlightedVocabulary(text, q.type || '');
    
    for (const item of highlightedItems) {
      const wordCount = item.split(/\s+/).filter(w => w.length >= 2).length;
      
      if (wordCount >= 2) {
        const normalizedPhrase = item.toLowerCase().trim();
        if (!processedPhrases.has(normalizedPhrase)) {
          processedPhrases.add(normalizedPhrase);
          phraseList.push({ phrase: normalizedPhrase });
          vocabList.push({
            word: normalizedPhrase,
            level: 5.0,
            cefr: 'C1',
            label: '숙어',
            emoji: '🔗',
            pos: '숙어',
            isPhrase: true,
          });
        }
        continue;
      }
      
      const cleanWord = item.replace(/[^a-zA-Z]/g, '').toLowerCase();
      if (processedWords.has(cleanWord)) continue;
      if (EXCLUDED_WORDS.has(cleanWord)) continue;
      if (cleanWord.length < 3) continue;
      
      processedWords.add(cleanWord);

        const detailedInfo = getDetailedWordInfo(cleanWord);
        if (detailedInfo) {
          if (detailedInfo.level <= 3.5) continue;
        
        const level = cefrToVocabLevel(detailedInfo.level);
        vocabLevelCounts[level]++;
        hardVocabCount++;
        
        vocabList.push({
          word: detailedInfo.word,
          level: detailedInfo.level,
          cefr: detailedInfo.cefr,
          label: detailedInfo.label,
          emoji: detailedInfo.emoji,
          pos: detailedInfo.posKorean,
        });
      }
    }
  }

  vocabList.sort((a, b) => a.word.localeCompare(b.word));
  phraseList.sort((a, b) => a.phrase.localeCompare(b.phrase));

  return { vocabLevelCounts, hardVocabCount, vocabList, phraseList };
}

const SOURCE_LABELS: Record<string, string> = {
  direct: '직접연계',
  indirect: '간접연계',
  external: '외부지문',
};

function calculateAverageDifficulty(
  questions: ExplanationQuestion[]
): 'high' | 'medium' | 'low' {
  const scores = { high: 3, medium: 2, low: 1 };
  const totalScore = questions.reduce((sum, q) => sum + scores[q.difficulty], 0);
  const avg = totalScore / questions.length;

  if (avg >= 2.5) return 'high';
  if (avg >= 1.5) return 'medium';
  return 'low';
}

export function generateOverviewData(
  questions: ExplanationQuestion[],
  ocrQuestions: OcrQuestion[] = []
): OverviewData {
  const totalQuestions = ocrQuestions.length > 0 ? ocrQuestions.length : questions.length;
  const explanationCount = questions.length;

  if (explanationCount !== totalQuestions) {
    console.warn(`[OverviewGenerator] 해설 수(${explanationCount}) != OCR 문제 수(${totalQuestions})`);
  }

  const sourceCounts: Record<string, number> = {
    direct: 0,
    indirect: 0,
    external: 0,
  };
  for (const q of questions) {
    const src = q.sourceType || 'external';
    sourceCounts[src]++;
  }

  const sourceDistribution = Object.entries(sourceCounts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({
      type: type as 'direct' | 'indirect' | 'external',
      label: SOURCE_LABELS[type],
      count,
      percentage: Math.round((count / totalQuestions) * 100),
    }));

  const typeCounts: Record<string, number> = {};
  
  if (ocrQuestions.length > 0) {
    for (const q of ocrQuestions) {
      const originalType = q.type || '기타';
      typeCounts[originalType] = (typeCounts[originalType] || 0) + 1;
    }
  } else {
    for (const q of questions) {
      const originalType = q.questionType || '기타';
      typeCounts[originalType] = (typeCounts[originalType] || 0) + 1;
    }
  }

  const typeDistribution = Object.entries(typeCounts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({
      type: type as QuestionType,
      label: type,
      count,
      percentage: Math.round((count / totalQuestions) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  const { vocabLevelCounts, hardVocabCount, vocabList, phraseList } = analyzeHighlightedVocabulary(ocrQuestions);

  const totalVocab = Object.values(vocabLevelCounts).reduce((a, b) => a + b, 0);
  const vocabDistribution = (Object.entries(vocabLevelCounts) as [VocabLevel, number][])
    .filter(([, count]) => count > 0)
    .map(([level, count]) => ({
      level,
      label: VOCAB_LEVELS[level].label,
      emoji: VOCAB_LEVELS[level].emoji,
      count,
      percentage: totalVocab > 0 ? Math.round((count / totalVocab) * 100) : 0,
    }));

  const directMatchRate = Math.round((sourceCounts.direct / totalQuestions) * 100);

  return {
    totalQuestions,
    averageDifficulty: calculateAverageDifficulty(questions),
    directMatchRate,
    hardVocabCount,
    sourceDistribution,
    typeDistribution,
    vocabDistribution,
    vocabList,
    phraseList,
  };
}
