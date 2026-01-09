import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.join(process.cwd(), 'word_cefr.db');
let db: Database.Database | null = null;
let dbInitError: Error | null = null;

function getDb(): Database.Database | null {
  if (dbInitError) {
    return null;
  }
  if (!db) {
    try {
      if (!fs.existsSync(dbPath)) {
        console.error(`[CEFR] DB file not found: ${dbPath}`);
        dbInitError = new Error(`DB file not found: ${dbPath}`);
        return null;
      }
      db = new Database(dbPath, { readonly: true });
      console.log(`[CEFR] DB connected successfully: ${dbPath}`);
    } catch (error) {
      console.error('[CEFR] DB connection error:', error);
      dbInitError = error as Error;
      return null;
    }
  }
  return db;
}

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface WordLevel {
  word: string;
  level: number;
  cefr: CEFRLevel;
  label: string;
  emoji: string;
}

function numberToCEFR(level: number): { cefr: CEFRLevel; label: string; emoji: string } {
  if (level <= 1.5) return { cefr: 'A1', label: '기초', emoji: '📗' };
  if (level <= 2.5) return { cefr: 'A2', label: '기초', emoji: '📗' };
  if (level <= 3.5) return { cefr: 'B1', label: '기본', emoji: '📗' };
  if (level <= 4.5) return { cefr: 'B2', label: '내신 기본', emoji: '📘' };
  if (level <= 5.5) return { cefr: 'C1', label: '상위권 필수', emoji: '📙' };
  return { cefr: 'C2', label: '최상위', emoji: '📕' };
}

export function getWordLevel(word: string): WordLevel | null {
  try {
    const db = getDb();
    if (!db) {
      console.warn(`[CEFR] DB not available, cannot lookup: ${word}`);
      return null;
    }
    
    const row = db.prepare(`
      SELECT w.word, AVG(wp.level) as avg_level 
      FROM words w 
      JOIN word_pos wp ON w.word_id = wp.word_id 
      WHERE LOWER(w.word) = LOWER(?)
      GROUP BY w.word
    `).get(word) as { word: string; avg_level: number } | undefined;

    if (!row) {
      return null;
    }

    const { cefr, label, emoji } = numberToCEFR(row.avg_level);
    return {
      word: row.word,
      level: row.avg_level,
      cefr,
      label,
      emoji,
    };
  } catch (error) {
    console.error(`[CEFR] Error looking up word "${word}":`, error);
    return null;
  }
}

export function getWordLevels(words: string[]): Map<string, WordLevel> {
  const result = new Map<string, WordLevel>();
  for (const word of words) {
    const level = getWordLevel(word);
    if (level) {
      result.set(word.toLowerCase(), level);
    }
  }
  return result;
}

export function getHighLevelWords(words: string[], minLevel: number = 4.5): WordLevel[] {
  const results: WordLevel[] = [];
  for (const word of words) {
    const level = getWordLevel(word);
    if (level && level.level >= minLevel) {
      results.push(level);
    }
  }
  return results.sort((a, b) => b.level - a.level);
}

const POS_KOREAN: Record<string, string> = {
  'NN': '명사', 'NNS': '명사', 'NNP': '고유명사', 'NNPS': '고유명사',
  'VB': '동사', 'VBD': '동사', 'VBG': '동사', 'VBN': '동사', 'VBP': '동사', 'VBZ': '동사',
  'JJ': '형용사', 'JJR': '형용사', 'JJS': '형용사',
  'RB': '부사', 'RBR': '부사', 'RBS': '부사',
  'IN': '전치사', 'CC': '접속사', 'DT': '관사', 'PRP': '대명사',
};

export interface DetailedWordInfo {
  word: string;
  level: number;
  cefr: CEFRLevel;
  label: string;
  emoji: string;
  pos: string;
  posKorean: string;
}

export function getDetailedWordInfo(word: string): DetailedWordInfo | null {
  try {
    const db = getDb();
    if (!db) return null;
    
    const row = db.prepare(`
      SELECT w.word, wp.level, pt.tag, pt.description
      FROM words w 
      JOIN word_pos wp ON w.word_id = wp.word_id 
      JOIN pos_tags pt ON wp.pos_tag_id = pt.tag_id
      WHERE LOWER(w.word) = LOWER(?)
      ORDER BY wp.frequency_count DESC
      LIMIT 1
    `).get(word) as { word: string; level: number; tag: string; description: string } | undefined;

    if (!row) return null;

    const { cefr, label, emoji } = numberToCEFR(row.level);
    return {
      word: row.word,
      level: row.level,
      cefr,
      label,
      emoji,
      pos: row.tag,
      posKorean: POS_KOREAN[row.tag] || row.description,
    };
  } catch (error) {
    console.error(`[CEFR] Error getting detailed info for "${word}":`, error);
    return null;
  }
}

export function getDetailedHighLevelWords(words: string[], minLevel: number = 4.5): DetailedWordInfo[] {
  const results: DetailedWordInfo[] = [];
  const seen = new Set<string>();
  
  for (const word of words) {
    const lower = word.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    
    const info = getDetailedWordInfo(word);
    if (info && info.level >= minLevel) {
      results.push(info);
    }
  }
  return results.sort((a, b) => b.level - a.level);
}
