import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { createHash } from 'crypto';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL_NAME = 'google/gemini-2.5-pro';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');
const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];
const geminiForPDF = genAI.getGenerativeModel({ model: 'gemini-2.5-pro', safetySettings });

function log(message: string, data?: unknown) {
  console.log(`[Analyzer] ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
}

// PDF 해시 계산
function computePdfHash(base64: string): string {
  return createHash('sha256').update(base64).digest('hex').substring(0, 16);
}

// OCR 캐시 조회
async function getCachedOcr(pdfHash: string): Promise<ExtractedSource[] | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003';
    const response = await fetch(`${baseUrl}/api/source-ocr-cache?hash=${pdfHash}`);
    const result = await response.json();

    if (result.success && result.cached && result.data) {
      log(`OCR 캐시 히트: ${result.data.file_name}`);
      return result.data.ocr_result as ExtractedSource[];
    }
    return null;
  } catch (error) {
    log(`OCR 캐시 조회 실패: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// OCR 결과 캐시 저장
async function saveOcrCache(
  pdfHash: string,
  fileName: string,
  sourceType: 'mock' | 'textbook',
  ocrResult: ExtractedSource[]
): Promise<void> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3003';
    await fetch(`${baseUrl}/api/source-ocr-cache`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfHash, fileName, sourceType, ocrResult }),
    });
    log(`OCR 캐시 저장: ${fileName} (${pdfHash})`);
  } catch (error) {
    log(`OCR 캐시 저장 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function joinBrokenLines(text: string): string {
  return text
    .split('\n')
    .reduce((acc: string[], line: string, i: number, arr: string[]) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        acc.push('');
        return acc;
      }
      
      const prevLine = acc[acc.length - 1];
      if (prevLine === undefined || prevLine === '') {
        acc.push(trimmedLine);
        return acc;
      }
      
      const endsWithPunctuation = /[.!?:;,)\]"']$/.test(prevLine);
      const startsWithCapital = /^[A-Z]/.test(trimmedLine);
      const startsWithMarkerOrBlank = /^[①②③④⑤ⓐⓑⓒⓓⓔⓕⓖ\d\(\[_\-]/.test(trimmedLine);
      const isShortLine = prevLine.length < 60;
      
      if (!endsWithPunctuation && !startsWithMarkerOrBlank && isShortLine) {
        acc[acc.length - 1] = prevLine + ' ' + trimmedLine;
      } else {
        acc.push(trimmedLine);
      }
      
      return acc;
    }, [])
    .join('\n')
    .replace(/\n{3,}/g, '\n\n');
}

function safeJsonParse<T>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString);
  } catch {
    const cleaned = jsonString
      .replace(/[\x00-\x1F\x7F]/g, ' ')
      .replace(/\\(?!["\\/bfnrtu])/g, '\\\\')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\t/g, '\\t');
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      log(`JSON 파싱 실패: ${e instanceof Error ? e.message : 'Unknown error'}`);
      return null;
    }
  }
}

// 텍스트 정규화 함수
function normalizeText(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);
}

// n-gram 생성 (연속된 n개 단어 조합)
function generateNgrams(words: string[], n: number): Set<string> {
  const ngrams = new Set<string>();
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.add(words.slice(i, i + n).join(' '));
  }
  return ngrams;
}

// 핵심 키워드 추출 (긴 단어, 고유명사 등)
function extractKeywords(text: string): Set<string> {
  const words = normalizeText(text);
  const keywords = new Set<string>();

  for (const word of words) {
    // 영어 5글자 이상 또는 한글 2글자 이상
    if (/^[a-z]+$/.test(word) && word.length >= 5) {
      keywords.add(word);
    } else if (/^[가-힣]+$/.test(word) && word.length >= 2) {
      keywords.add(word);
    }
  }

  return keywords;
}

// 텍스트 유사도 계산 (다중 지표 결합)
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;

  const words1 = normalizeText(text1);
  const words2 = normalizeText(text2);

  if (words1.length === 0 || words2.length === 0) return 0;

  // 1. 단어 집합 유사도 (Jaccard)
  const set1 = new Set(words1);
  const set2 = new Set(words2);

  let wordIntersection = 0;
  for (const word of set1) {
    if (set2.has(word)) wordIntersection++;
  }
  const wordUnion = set1.size + set2.size - wordIntersection;
  const wordSimilarity = wordUnion > 0 ? wordIntersection / wordUnion : 0;

  // 2. 바이그램(2-gram) 유사도 - 연속된 단어 쌍 매칭
  const bigrams1 = generateNgrams(words1, 2);
  const bigrams2 = generateNgrams(words2, 2);

  let bigramIntersection = 0;
  for (const bg of bigrams1) {
    if (bigrams2.has(bg)) bigramIntersection++;
  }
  const bigramUnion = bigrams1.size + bigrams2.size - bigramIntersection;
  const bigramSimilarity = bigramUnion > 0 ? bigramIntersection / bigramUnion : 0;

  // 3. 트라이그램(3-gram) 유사도 - 3단어 연속 매칭
  const trigrams1 = generateNgrams(words1, 3);
  const trigrams2 = generateNgrams(words2, 3);

  let trigramIntersection = 0;
  for (const tg of trigrams1) {
    if (trigrams2.has(tg)) trigramIntersection++;
  }
  const trigramUnion = trigrams1.size + trigrams2.size - trigramIntersection;
  const trigramSimilarity = trigramUnion > 0 ? trigramIntersection / trigramUnion : 0;

  // 4. 핵심 키워드 유사도 (가장 중요!)
  const keywords1 = extractKeywords(text1);
  const keywords2 = extractKeywords(text2);

  let keywordIntersection = 0;
  for (const kw of keywords1) {
    if (keywords2.has(kw)) keywordIntersection++;
  }
  // 키워드는 짧은 쪽 기준으로 계산 (recall 기반)
  const minKeywords = Math.min(keywords1.size, keywords2.size);
  const keywordSimilarity = minKeywords > 0 ? keywordIntersection / minKeywords : 0;

  // 5. 가중 평균 (n-gram과 키워드에 더 높은 가중치)
  // 단어: 15%, 바이그램: 25%, 트라이그램: 30%, 키워드: 30%
  const finalScore =
    wordSimilarity * 0.15 +
    bigramSimilarity * 0.25 +
    trigramSimilarity * 0.30 +
    keywordSimilarity * 0.30;

  return finalScore;
}

// 가장 유사한 원문 찾기
function findBestMatchingSource(
  questionText: string,
  sources: Array<{ id: string; name: string; number: number; text: string }>
): { source: typeof sources[0] | null; similarity: number } {
  let bestSource: typeof sources[0] | null = null;
  let bestSimilarity = 0;

  for (const source of sources) {
    const similarity = calculateSimilarity(questionText, source.text);
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestSource = source;
    }
  }

  return { source: bestSource, similarity: bestSimilarity };
}

interface OpenRouterResponse {
  choices: Array<{ message: { content: string } }>;
}

async function callOpenRouter(prompt: string): Promise<string> {
  if (!OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY가 설정되지 않았습니다.');
  
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://exam-analyzer.vercel.app',
      'X-Title': 'Exam Analyzer',
    },
    body: JSON.stringify({
      model: MODEL_NAME,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 65536,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API 오류: ${response.status}`);
  }

  const data = (await response.json()) as OpenRouterResponse;
  return data.choices[0]?.message?.content || '';
}

export interface ExtractedQuestion {
  number: number;
  text: string;
  type?: string;
}

export interface ExtractedSource {
  number: number;
  title?: string;
  text: string;
}

export interface MatchResult {
  questionNumber: number;
  questionText: string;
  sourceType: 'direct' | 'indirect' | 'external';
  sourceName: string;
  sourceNumber: number | null;
  sourceText: string;
  confidence: number;
  reasoning: string;
}

export interface ConfirmedMatch {
  questionNumber: number;
  questionText: string;
  sourceType: 'direct' | 'indirect' | 'external';
  sourceName: string;
  sourceText: string;
}

export interface DetailedAnalysis {
  questionNumber: number;
  questionText: string;
  sourceType: 'direct' | 'indirect' | 'external';
  sourceName: string;
  questionType: string;
  originalType?: string;
  difficulty: 'high' | 'medium' | 'low';
  sentenceComparisons: Array<{
    original: string;
    transformed: string;
    changeType: string;
    explanation: string;
  }>;
  vocabularyChanges: Array<{
    original: string;
    transformed: string;
    originalContext: string;
    transformedContext: string;
    tepsLevel: number;
  }>;
  grammarPoints?: Array<{
    choiceNumber: string | number;
    content: string;
    grammaticalFocus: string;
    isCorrect: boolean;
    explanation: string;
  }>;
  wrongAnswerAnalysis?: Array<{
    choice: string;
    reason: string;
  }>;
  transformationSummary: string;
  teacherIntent: string;
  answerRationale: string;
  studyTips: string[];
}

export type ReportStatus = 'matching' | 'matching_review' | 'analyzing' | 'review' | 'rejected' | 'approved' | 'published';

export interface ReportState {
  status: ReportStatus;
  matches?: MatchResult[];
  confirmedMatches?: ConfirmedMatch[];
  analysis?: DetailedAnalysis[];
  rejectionFeedback?: string;
  publishedAt?: string;
}

export async function extractQuestionsFromPDF(pdfBase64: string): Promise<ExtractedQuestion[]> {
  log('기출문제 PDF OCR 시작...');

  const prompt = `이 PDF는 영어 시험지입니다.

각 문제를 추출해주세요:
1. 문제 번호를 기준으로 구분
2. 각 문제의 전체 텍스트(지시문 + 지문 + 선택지) 추출
3. 문제 유형 추측 (빈칸추론, 어법, 순서배열, 주제, 요지, 제목 등)

## ⚠️ 다단(2단/3단) 레이아웃 처리 - 매우 중요!
- 시험지는 보통 2단 또는 3단으로 되어 있습니다
- 다단 레이아웃 때문에 줄이 짧게 끊기지만, 문장은 자연스럽게 이어서 추출하세요
- 예시 (잘못된 추출):
  "The above graph shows the electricity
  generation from fossil fuels."
- 예시 (올바른 추출):
  "The above graph shows the electricity generation from fossil fuels."
- 문장 중간에 줄바꿈이 있으면 공백으로 연결해서 하나의 문장으로 만드세요
- 문단 구분(빈 줄)만 줄바꿈으로 유지하세요

## ⚠️ 가장 중요한 규칙: 있는 그대로만!
- PDF에 실제로 보이는 텍스트만 옮겨적으세요
- **절대로 없는 내용을 만들어내지 마세요!**
- 패턴을 보고 추측해서 추가하지 마세요 (예: ⓐⓑⓒⓓⓔⓕⓖ 다음에 ⓗ가 있을 것 같아도, PDF에 없으면 절대 추가 금지!)

## 어법/어휘 문제 밑줄/원문자 규칙
- 원문자: PDF에 실제로 있는 것만 (ⓐ ⓑ ⓒ 등)
- 밑줄: PDF에서 실제로 밑줄 친 단어만 **단어** 형식으로 표시
- 예시: "out ⓐ **came** the coach" (came에만 밑줄이 있으면 came만)

## ⚠️ 어휘 문제 (문맥상 낱말의 쓰임) 특별 규칙
- 어휘 문제는 반드시 ① ② ③ ④ ⑤ 총 5개의 밑줄 단어가 있음!
- 4개만 보이면 하나를 놓친 것! PDF를 다시 꼼꼼히 확인!
- 각 번호 앞뒤로 밑줄 친 단어가 있는지 확인
- 예: "① leeway", "② inescapable", "③ mandatory", "④ compromise", "⑤ negligible"
- 절대 ①②③④만 추출하고 ⑤를 빠뜨리지 마세요!

## 선택지 번호
- ① ② ③ ④ ⑤ (숫자 원문자)

JSON 배열로 반환:
[{"number": 1, "text": "문제 전체 텍스트", "type": "빈칸추론"}, ...]

JSON만 반환하세요.`;

  const result = await geminiForPDF.generateContent([
    prompt,
    { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
  ]);

  const responseText = result.response.text();
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('OCR 결과 파싱 실패');

  const questions = safeJsonParse<ExtractedQuestion[]>(jsonMatch[0]);
  if (!questions) throw new Error('문제 JSON 파싱 실패');
  
  const cleanedQuestions = questions.map(q => ({
    ...q,
    text: joinBrokenLines(q.text),
  }));
  
  log(`${cleanedQuestions.length}개 문제 추출 완료`);
  return cleanedQuestions;
}

export async function extractSourcesFromPDF(pdfBase64: string): Promise<ExtractedSource[]> {
  log('원문 PDF OCR 시작...');
  log(`PDF 크기: ${(pdfBase64.length / 1024 / 1024).toFixed(2)}MB`);

  const prompt = `이 PDF는 영어 모의고사 또는 교과서입니다.

## ⚠️ 문서 유형별 처리 (매우 중요!)

### 모의고사 (수능/평가원/교육청) - 원문 그대로 추출!
문제를 **원래 형태 그대로** 추출하세요:
- (A), (B), (C) 순서 마커 **그대로 유지**
- 빈칸 (___________) **그대로 유지**
- 밑줄 친 부분은 **표시 유지** (예: *밑줄 표시* 또는 그대로)
- ①②③④⑤ 원문자/번호 **그대로 유지**
- 박스/인용문 형태 **그대로 유지**

### 복합지문 처리 (41-42, 43-45 등)
복합지문은 **각 문제별로 분리**해서 추출:
- 41번: [공통 지문 전체] + [41번 질문] + [41번 선택지]
- 42번: [공통 지문 전체] + [42번 질문] + [42번 선택지]
공통 지문이 중복되어도 괜찮습니다. 각 문제가 완전한 맥락을 갖도록 하세요.

### 교과서 (2단 레이아웃)
- ⚠️ 왼쪽 열 = 영어 원문, 오른쪽 열 = 한국어 번역
- **반드시 왼쪽 열의 영어 텍스트만 추출하세요!**
- 오른쪽 열의 한국어 번역은 무시하세요

## ⚠️ 다단(2단/3단) 레이아웃 처리
- 다단 레이아웃 때문에 줄이 짧게 끊기지만, 문장은 자연스럽게 이어서 추출
- 문장 중간의 줄바꿈은 공백으로 연결

## 📐 모의고사 추출 형식 (중요!)

### 포함할 내용 (원문 그대로!)
- 문제 지시문 (예: "다음 글의 순서로 가장 적절한 것은?")
- 본문 텍스트 전체 (영어)
- (A), (B), (C) 등의 문단 구분 마커
- 빈칸, 밑줄 표시
- 원문자 ①②③④⑤ (본문 내에 있는 경우)
- 선택지 보기 (① ② ③ ④ ⑤ 형태의 답 선택지도 포함!)

### 제외할 내용
- 한글 어휘 주석 (예: *grudging: 투덜대는)
- 페이지 번호, 헤더/푸터

## 번호 부여 규칙
- 모의고사: 실제 문제 번호 사용 (18, 19, 20...)
- 교과서: 각 Reading 본문을 순서대로 1, 2, 3...

JSON 배열로 반환:
[{"number": 36, "title": "순서추론", "text": "지시문 + 본문 전체 (마커 포함)"}, ...]

JSON만 반환하세요.`;

  try {
    log('Gemini API 호출 중...');
    const result = await geminiForPDF.generateContent([
      prompt,
      { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
    ]);

    const responseText = result.response.text();
    log(`Gemini 응답 길이: ${responseText.length}자`);
    log(`Gemini 응답 미리보기: ${responseText.substring(0, 500)}`);
    
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      log('JSON 파싱 실패 - 응답에서 JSON 배열을 찾을 수 없음');
      return [];
    }

    const sources = safeJsonParse<ExtractedSource[]>(jsonMatch[0]);
    if (!sources) {
      log('원문 JSON 파싱 실패');
      return [];
    }
    
    const cleanedSources = sources.map(s => ({
      ...s,
      text: joinBrokenLines(s.text),
    }));
    
    log(`${cleanedSources.length}개 원문 추출 완료`);
    return cleanedSources;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`원문 추출 오류: ${errorMessage}`);
    console.error('Full error:', error);
    return [];
  }
}

export async function runMatchingAnalysis(
  examPdfBase64: string,
  sourcePdfs: Array<{ name: string; base64: string }>,
  answerKey: string,
  pageLayout: string,
  onProgress?: (step: string, progress: number) => void
): Promise<{
  questions: ExtractedQuestion[];
  sources: Array<{ name: string; texts: ExtractedSource[] }>;
  matches: MatchResult[];
}> {
  log('=== 매칭 분석 시작 ===');
  log(`정답 정보: ${answerKey || '없음'}`);
  log(`페이지 배치: ${pageLayout || '없음'}`);
  onProgress?.('PDF 분석', 0);

  const questions = await extractQuestionsFromPDF(examPdfBase64);
  onProgress?.('PDF 분석', 30);

  const sources: Array<{ name: string; texts: ExtractedSource[] }> = [];
  for (let i = 0; i < sourcePdfs.length; i++) {
    const pdf = sourcePdfs[i];
    const pdfHash = computePdfHash(pdf.base64);
    log(`원문 PDF 처리: ${pdf.name} (해시: ${pdfHash})`);

    // 1. 캐시 확인
    const cachedResult = await getCachedOcr(pdfHash);
    if (cachedResult) {
      log(`✅ 캐시에서 로드: ${pdf.name} (${cachedResult.length}개 원문)`);
      sources.push({ name: pdf.name, texts: cachedResult });
      onProgress?.('PDF 분석', 30 + ((i + 1) / sourcePdfs.length) * 30);
      continue;
    }

    // 2. 캐시 없으면 OCR 실행
    log(`🔄 OCR 실행: ${pdf.name}`);
    const texts = await extractSourcesFromPDF(pdf.base64);
    sources.push({ name: pdf.name, texts });

    // 3. OCR 결과 캐시에 저장
    if (texts.length > 0) {
      const sourceType = /교과서|본문|lesson/i.test(pdf.name) ? 'textbook' : 'mock';
      await saveOcrCache(pdfHash, pdf.name, sourceType, texts);
    }

    onProgress?.('PDF 분석', 30 + ((i + 1) / sourcePdfs.length) * 30);
  }

  onProgress?.('매칭 분석', 60);
  const matches: MatchResult[] = [];

  if (sources.length === 0 || sources.every(s => s.texts.length === 0)) {
    for (const q of questions) {
      matches.push({
        questionNumber: q.number,
        questionText: q.text,
        sourceType: 'external',
        sourceName: '외부지문',
        sourceNumber: null,
        sourceText: '',
        confidence: 0,
        reasoning: '원문 PDF가 제공되지 않았습니다.',
      });
    }
  } else {
    const allSources = sources.flatMap(s => 
      s.texts.map((t, idx) => ({ 
        id: `${s.name}_${t.number || idx}`,
        name: s.name, 
        number: t.number, 
        text: t.text,
        preview: t.text.substring(0, 300)
      }))
    );

    const sourcesFormatted = allSources
      .map(s => `[ID: ${s.id}]\n[출처: ${s.name}]\n${s.preview}...`)
      .join('\n\n---\n\n');

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      onProgress?.('매칭 분석', 60 + ((i + 1) / questions.length) * 40);

      const prompt = `당신은 영어 내신 기출문제 분석 전문가입니다.

## 기출문제 ${q.number}번
${q.text.substring(0, 1500)}

## 원문 후보들
${sourcesFormatted}

## 매칭 방법
기출문제 지문과 원문 후보들의 **실제 내용**을 비교하세요:
- 같은 주제/소재를 다루는가?
- 같은 문장이나 표현이 있는가?
- 핵심 키워드가 일치하는가?

## 판단 기준
- 직접연계(direct): 문장의 70%+ 유사, 같은 내용을 패러프레이징
- 간접연계(indirect): 같은 주제/소재지만 대부분 새로 작성
- 외부지문(external): 원문 후보들과 관련 없는 새 지문

## JSON으로 반환
{
  "source_type": "direct/indirect/external",
  "matched_source_id": "매칭된 원문의 ID (예: 파일명_번호)",
  "source_name": "출처명 (예: 2024년 3월 모의고사 18번, 교과서 Lesson 3)",
  "confidence": 0-100,
  "reasoning": "어떤 내용이 일치하는지 구체적으로 (2-3문장)"
}

⚠️ 중요: matched_source_id는 위 원문 후보들의 [ID: xxx] 값을 정확히 복사하세요.
외부지문이면 matched_source_id는 빈 문자열 ""로.

JSON만 반환하세요.`;

      try {
        const response = await callOpenRouter(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const parsed = safeJsonParse<Record<string, unknown>>(jsonMatch[0]);
          if (!parsed) {
            log(`문제 ${q.number} 매칭 JSON 파싱 실패, 외부지문으로 처리`);
            matches.push({
              questionNumber: q.number,
              questionText: q.text,
              sourceType: 'external',
              sourceName: '외부지문',
              sourceNumber: 0,
              sourceText: '',
              confidence: 0,
              reasoning: 'JSON 파싱 실패',
            });
            continue;
          }
          const matchedSource = allSources.find(s => s.id === parsed.matched_source_id);
          const sourceText = matchedSource?.text || '';

          const fullSourceName = (parsed.source_name as string) || 
            (matchedSource?.number 
              ? `${matchedSource.name} ${matchedSource.number}번` 
              : matchedSource?.name) || 
            '외부지문';

          matches.push({
            questionNumber: q.number,
            questionText: q.text,
            sourceType: (parsed.source_type as 'direct' | 'indirect' | 'external') || 'external',
            sourceName: fullSourceName,
            sourceNumber: matchedSource?.number || null,
            sourceText,
            confidence: (parsed.confidence as number) || 0,
            reasoning: (parsed.reasoning as string) || '',
          });
        } else {
          matches.push({
            questionNumber: q.number,
            questionText: q.text,
            sourceType: 'external',
            sourceName: '외부지문',
            sourceNumber: null,
            sourceText: '',
            confidence: 0,
            reasoning: '매칭 분석 실패',
          });
        }
      } catch (error) {
        matches.push({
          questionNumber: q.number,
          questionText: q.text,
          sourceType: 'external',
          sourceName: '외부지문',
          sourceNumber: null,
          sourceText: '',
          confidence: 0,
          reasoning: `오류: ${error instanceof Error ? error.message : '알 수 없음'}`,
        });
      }
    }
  }

  log(`매칭 완료: ${matches.filter(m => m.sourceType !== 'external').length}/${matches.length} 연계`);
  return { questions, sources, matches };
}

interface QuestionGroup {
  id: string;
  label: string;
  questionNumbers: number[];
}

export async function runMatchingWithGroups(
  questions: ExtractedQuestion[],
  allSources: Array<{ id: string; name: string; number: number; text: string }>,
  answerKey: string,
  groups: QuestionGroup[],
  onProgress?: (step: string, progress: number) => void
): Promise<MatchResult[]> {
  log('=== 매칭 분석 (복합지문 그룹 포함) 시작 ===');
  log(`복합지문 그룹: ${groups.length}개`);
  groups.forEach(g => log(`  - ${g.label}: 문제 ${g.questionNumbers.join(', ')}번`));
  
  const matches: MatchResult[] = [];
  const groupMatchCache = new Map<string, MatchResult>();
  
  const sourcesFormatted = allSources
    .map(s => `[ID: ${s.id}]\n[출처: ${s.name}]\n${s.text.substring(0, 300)}...`)
    .join('\n\n---\n\n');

  const getQuestionGroup = (questionNumber: number): QuestionGroup | undefined => {
    return groups.find(g => g.questionNumbers.includes(questionNumber));
  };

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    onProgress?.('매칭 분석', ((i + 1) / questions.length) * 100);

    const group = getQuestionGroup(q.number);
    
    if (group && groupMatchCache.has(group.id)) {
      const cachedMatch = groupMatchCache.get(group.id)!;
      log(`문제 ${q.number}번: 복합지문 [${group.label}] - 캐시된 매칭 결과 사용 (${cachedMatch.sourceName})`);
      
      const sharedPassageText = `[복합지문 ${group.label}]\n${q.text}`;
      
      matches.push({
        questionNumber: q.number,
        questionText: sharedPassageText,
        sourceType: cachedMatch.sourceType,
        sourceName: cachedMatch.sourceName,
        sourceNumber: cachedMatch.sourceNumber,
        sourceText: cachedMatch.sourceText,
        confidence: cachedMatch.confidence,
        reasoning: `복합지문 [${group.label}]의 일부입니다. ${cachedMatch.reasoning}`,
      });
      continue;
    }

    let questionTextForMatching = q.text;
    if (group) {
      const groupQuestions = questions.filter(gq => group.questionNumbers.includes(gq.number));
      questionTextForMatching = `[복합지문 ${group.label}]\n\n` + 
        groupQuestions.map(gq => `문제 ${gq.number}번:\n${gq.text}`).join('\n\n---\n\n');
      log(`문제 ${q.number}번: 복합지문 [${group.label}] 대표 분석 중...`);
    }

    const prompt = `당신은 영어 내신 기출문제 분석 전문가입니다.

## 기출문제 ${group ? `[복합지문 ${group.label}]` : `${q.number}번`}
${questionTextForMatching.substring(0, 2000)}

## 원문 후보들
${sourcesFormatted}

## 매칭 방법
기출문제 지문과 원문 후보들의 **실제 내용**을 비교하세요:
- 같은 주제/소재를 다루는가?
- 같은 문장이나 표현이 있는가?
- 핵심 키워드가 일치하는가?
${group ? `\n⚠️ 이것은 복합지문 [${group.label}]입니다. ${group.questionNumbers.length}개의 문제가 하나의 지문을 공유합니다.` : ''}

## 🚨🚨🚨 매칭 전 필수 확인 - 내용이 실제로 같은가? 🚨🚨🚨

### ⚠️ 절대 규칙: 주제와 내용이 일치해야만 매칭!
1. 기출문제 지문의 **핵심 주제**를 파악 (예: AI neural implants? art gallery? environmental issues?)
2. 각 원문 후보의 **핵심 주제**를 파악
3. **주제가 같은 원문만 매칭!** 주제가 다르면 절대 매칭 금지!

### ❌ 잘못된 매칭 예시 (절대 하지 마세요):
- 기출: "AI-powered neural implants" ↔ 원문: "Bill Traylor, art gallery" → **매칭 금지!**
- 기출: "environmental protection" ↔ 원문: "social media" → **매칭 금지!**

### ✅ 올바른 매칭:
- 기출: "AI neural implants" ↔ 원문: "AI, brain implants, medical" → 매칭 OK
- 기출: "Bill Traylor paintings" ↔ 원문: "Bill Traylor, art, slavery" → 매칭 OK

### 교과서 3과 vs 4과 구분:
- 3과와 4과는 **완전히 다른 주제**!
- 기출 내용의 주제가 3과 원문 주제와 같으면 → 3과 매칭
- 기출 내용의 주제가 4과 원문 주제와 같으면 → 4과 매칭
- **어느 과와도 내용이 안 맞으면 → external(외부지문)!**

## 연계 유형 판단 기준
- 직접연계(direct): 원문과 거의 동일하고 **단어 몇 개만 변형**됨 (동의어 치환, 시제 변경, 능동/수동 전환 등)
- 간접연계(indirect): 원문과 같은 내용이지만 **문장 전체가 패러프레이징**됨 (문장 구조 변경, 새로운 표현으로 재작성)
- 외부지문(external): 원문 후보들 중 **일치하는 것을 찾을 수 없음** (완전히 새로운 지문)

## ⚠️ 원문 ID/출처명 작성 규칙 (매우 중요!)
### 모의고사인 경우:
- matched_source_id: "파일명_번호" 형태 (예: "2024년 10월 고1 모의고사_25")
- source_name: "2024년 10월 고1 모의고사 25번" 형태

### 교과서/본문인 경우:
- matched_source_id: "파일명_번호" 형태 (예: "3과_본문_1" 또는 "4과_본문_1")
- source_name: 반드시 "N과" 형태 포함! (예: "교과서 3과 본문", "4과 본문 1번")
- ⚠️ 교과서 파일은 "3과_본문", "4과_본문" 등의 이름을 가짐
- ⚠️ 교과서 내용과 매칭되면 반드시 source_name에 "N과" 패턴 포함!

## JSON으로 반환 (반드시 이 형식으로)
{
  "source_type": "direct/indirect/external",
  "matched_source_id": "원문 ID (위 목록에서 [ID: xxx] 형태로 표시된 값)",
  "source_number": 원문 번호 (숫자만, 예: 18),
  "source_name": "출처명 (예: 2024년 3월 모의고사 18번, 교과서 3과 본문)",
  "confidence": 0-100,
  "reasoning": "매칭 이유"
}

JSON만 반환하세요.`;

    try {
      const response = await callOpenRouter(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = safeJsonParse<Record<string, unknown>>(jsonMatch[0]);
        if (parsed) {
          let matchedSource = allSources.find(s => s.id === parsed.matched_source_id);
          
          if (!matchedSource && parsed.source_number && parsed.source_name) {
            const srcName = String(parsed.source_name);
            matchedSource = allSources.find(s => 
              s.number === Number(parsed.source_number) && 
              (srcName.includes(s.name) || s.name.includes(srcName) || s.id.toLowerCase().includes(srcName.toLowerCase().replace(/\s+/g, '_')))
            );
          }
          
          // ID로 매칭 시도
          if (!matchedSource && parsed.matched_source_id) {
            const idStr = String(parsed.matched_source_id);
            matchedSource = allSources.find(s => s.id === idStr || s.id.includes(idStr) || idStr.includes(s.id));
          }

          // 번호로 매칭 (source_number가 있는 경우)
          if (!matchedSource && parsed.source_number) {
            matchedSource = allSources.find(s => s.number === Number(parsed.source_number));
          }

          // source_name에서 번호 추출해서 매칭 (모의고사용)
          if (!matchedSource && parsed.source_name) {
            const sourceName = String(parsed.source_name);
            const numberMatch = sourceName.match(/(\d+)번/);
            if (numberMatch) {
              matchedSource = allSources.find(s => s.number === Number(numberMatch[1]));
            }
          }

          // 교과서/본문 매칭 (N과 패턴)
          if (!matchedSource && parsed.source_name) {
            const sourceName = String(parsed.source_name);
            const isTextbook = /교과서|본문|과_본문|과 본문/.test(sourceName);

            if (isTextbook) {
              const lessonMatch = sourceName.match(/(\d+)과/);
              if (lessonMatch) {
                const lessonNum = lessonMatch[1];
                // 해당 과가 포함된 source 찾기
                matchedSource = allSources.find(s => {
                  const normalizedName = s.name.replace(/[\s_]+/g, '').toLowerCase();
                  return normalizedName.includes(`${lessonNum}과`);
                });
                log(`교과서 매칭 시도: ${lessonNum}과 -> ${matchedSource?.name || '없음'}`);
              }
            }
          }

          // 파일명 직접 비교 (정규화해서)
          if (!matchedSource && parsed.source_name) {
            const sourceName = String(parsed.source_name);
            const normalizedSourceName = sourceName.replace(/[\s_]+/g, '').toLowerCase();

            matchedSource = allSources.find(s => {
              const normalizedName = s.name.replace(/[\s_]+/g, '').toLowerCase();
              return normalizedName.includes(normalizedSourceName.slice(0, 20)) ||
                     normalizedSourceName.includes(normalizedName.slice(0, 20));
            });
          }

          log(`AI 매칭 결과: source_id=${parsed.matched_source_id}, source_name=${parsed.source_name}, found=${!!matchedSource}`);

          // 🚨🚨🚨 핵심 로직: 유사도 기반 매칭 (AI 결과 무시하고 직접 계산) 🚨🚨🚨
          const SIMILARITY_THRESHOLD = 0.05; // 5% 이상 단어 겹쳐야 매칭 인정

          // 1. 모든 원문과 유사도 계산하여 가장 높은 것 찾기
          const { source: bestSource, similarity: bestSimilarity } = findBestMatchingSource(q.text, allSources);

          log(`\n========== 유사도 기반 매칭: 문제 ${q.number}번 ==========`);
          // 모든 원문 유사도 상세 로깅
          const detailedSimilarities = allSources.map(s => {
            const words1 = normalizeText(q.text);
            const words2 = normalizeText(s.text);
            const set1 = new Set(words1);
            const set2 = new Set(words2);

            // 단어 유사도
            let wordInt = 0;
            for (const w of set1) if (set2.has(w)) wordInt++;
            const wordSim = (set1.size + set2.size - wordInt) > 0 ? wordInt / (set1.size + set2.size - wordInt) : 0;

            // 바이그램
            const bg1 = generateNgrams(words1, 2);
            const bg2 = generateNgrams(words2, 2);
            let bgInt = 0;
            for (const b of bg1) if (bg2.has(b)) bgInt++;
            const bgSim = (bg1.size + bg2.size - bgInt) > 0 ? bgInt / (bg1.size + bg2.size - bgInt) : 0;

            // 트라이그램
            const tg1 = generateNgrams(words1, 3);
            const tg2 = generateNgrams(words2, 3);
            let tgInt = 0;
            for (const t of tg1) if (tg2.has(t)) tgInt++;
            const tgSim = (tg1.size + tg2.size - tgInt) > 0 ? tgInt / (tg1.size + tg2.size - tgInt) : 0;

            // 키워드
            const kw1 = extractKeywords(q.text);
            const kw2 = extractKeywords(s.text);
            let kwInt = 0;
            for (const k of kw1) if (kw2.has(k)) kwInt++;
            const kwSim = Math.min(kw1.size, kw2.size) > 0 ? kwInt / Math.min(kw1.size, kw2.size) : 0;

            const total = wordSim * 0.15 + bgSim * 0.25 + tgSim * 0.30 + kwSim * 0.30;

            return {
              name: s.name,
              total,
              wordSim,
              bgSim,
              tgSim,
              kwSim,
              kwMatched: kwInt,
              kwTotal: kw1.size
            };
          }).sort((a, b) => b.total - a.total);

          detailedSimilarities.forEach((s, i) => {
            log(`  ${i + 1}. ${s.name}: 총합=${(s.total * 100).toFixed(1)}%`);
            log(`     단어=${(s.wordSim * 100).toFixed(1)}%, 2gram=${(s.bgSim * 100).toFixed(1)}%, 3gram=${(s.tgSim * 100).toFixed(1)}%, 키워드=${(s.kwSim * 100).toFixed(1)}% (${s.kwMatched}/${s.kwTotal})`);
          });

          const similarities = detailedSimilarities.slice(0, 3);

          // 2. AI 매칭 결과와 유사도 매칭 결과 비교
          let finalSource: typeof allSources[0] | null = null;

          if (bestSource && bestSimilarity >= SIMILARITY_THRESHOLD) {
            // 유사도 기반 매칭 성공
            if (matchedSource && matchedSource.id === bestSource.id) {
              log(`✅ AI 매칭 확인됨: ${bestSource.name} (유사도 ${(bestSimilarity * 100).toFixed(1)}%)`);
            } else if (matchedSource) {
              const aiSimilarity = calculateSimilarity(q.text, matchedSource.text);
              log(`⚠️ AI 매칭 오류 감지!`);
              log(`   AI가 선택: ${matchedSource.name} (유사도 ${(aiSimilarity * 100).toFixed(1)}%)`);
              log(`   실제 최적: ${bestSource.name} (유사도 ${(bestSimilarity * 100).toFixed(1)}%)`);
            }
            finalSource = bestSource;
          } else {
            // 유사도 기반 매칭 실패 - 외부지문
            log(`❌ 유사한 원문 없음 (최고 유사도: ${(bestSimilarity * 100).toFixed(1)}% < ${SIMILARITY_THRESHOLD * 100}%) - 외부지문 처리`);
            finalSource = null;
          }

          let finalQuestionText = q.text;
          if (group) {
            finalQuestionText = `[복합지문 ${group.label}]\n${q.text}`;
          }

          // 유사도 기반 최종 결과 생성
          const finalSourceType = finalSource
            ? (parsed.source_type as 'direct' | 'indirect' | 'external') || 'direct'
            : 'external';

          const matchResult: MatchResult = {
            questionNumber: q.number,
            questionText: finalQuestionText,
            sourceType: finalSourceType,
            sourceName: finalSource ? (finalSource.name.includes('과') ? `교과서 ${finalSource.name}` : finalSource.name) : '외부지문',
            sourceNumber: finalSource?.number || null,
            sourceText: finalSource?.text || '',
            confidence: Math.round(bestSimilarity * 100),
            reasoning: finalSource ? `유사도 ${(bestSimilarity * 100).toFixed(1)}%로 매칭됨` : '유사한 원문 없음',
          };

          matches.push(matchResult);

          if (group) {
            groupMatchCache.set(group.id, matchResult);
            log(`복합지문 [${group.label}] 매칭 결과 캐시됨: ${matchResult.sourceName}`);
          }
          continue;
        }
      }
      
      let fallbackQuestionText = q.text;
      if (group) {
        fallbackQuestionText = `[복합지문 ${group.label}]\n${q.text}`;
      }
      
      const fallbackResult: MatchResult = {
        questionNumber: q.number,
        questionText: fallbackQuestionText,
        sourceType: 'external',
        sourceName: '외부지문',
        sourceNumber: null,
        sourceText: '',
        confidence: 0,
        reasoning: '매칭 실패',
      };
      matches.push(fallbackResult);
      
      if (group) {
        groupMatchCache.set(group.id, fallbackResult);
      }
    } catch (error) {
      let errorQuestionText = q.text;
      if (group) {
        errorQuestionText = `[복합지문 ${group.label}]\n${q.text}`;
      }
      
      const errorResult: MatchResult = {
        questionNumber: q.number,
        questionText: errorQuestionText,
        sourceType: 'external',
        sourceName: '외부지문',
        sourceNumber: null,
        sourceText: '',
        confidence: 0,
        reasoning: `오류: ${error instanceof Error ? error.message : '알 수 없음'}`,
      };
      matches.push(errorResult);
      
      if (group) {
        groupMatchCache.set(group.id, errorResult);
      }
    }
  }

  const linkedCount = matches.filter(m => m.sourceType !== 'external').length;
  log(`매칭 완료: ${linkedCount}/${matches.length} 연계`);
  return matches;
}

export async function runMatchingOnly(
  questions: ExtractedQuestion[],
  allSources: Array<{ id: string; name: string; number: number; text: string }>,
  answerKey: string,
  onProgress?: (step: string, progress: number) => void
): Promise<MatchResult[]> {
  log('=== 매칭 분석 (OCR 후) 시작 ===');
  const matches: MatchResult[] = [];

  const sourcesFormatted = allSources
    .map(s => `[ID: ${s.id}]\n[출처: ${s.name}]\n${s.text.substring(0, 300)}...`)
    .join('\n\n---\n\n');

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    onProgress?.('매칭 분석', ((i + 1) / questions.length) * 100);

    const prompt = `당신은 영어 내신 기출문제 분석 전문가입니다.

## 기출문제 ${q.number}번
${q.text.substring(0, 1500)}

## 원문 후보들
${sourcesFormatted}

## 매칭 방법
기출문제 지문과 원문 후보들의 **실제 내용**을 비교하세요:
- 같은 주제/소재를 다루는가?
- 같은 문장이나 표현이 있는가?
- 핵심 키워드가 일치하는가?

## 🚨🚨🚨 매칭 전 필수 확인 - 내용이 실제로 같은가? 🚨🚨🚨

### ⚠️ 절대 규칙: 주제와 내용이 일치해야만 매칭!
1. 기출문제 지문의 **핵심 주제**를 파악 (예: AI neural implants? art gallery? environmental issues?)
2. 각 원문 후보의 **핵심 주제**를 파악
3. **주제가 같은 원문만 매칭!** 주제가 다르면 절대 매칭 금지!

### ❌ 잘못된 매칭 예시 (절대 하지 마세요):
- 기출: "AI-powered neural implants" ↔ 원문: "Bill Traylor, art gallery" → **매칭 금지!**
- 기출: "environmental protection" ↔ 원문: "social media" → **매칭 금지!**

### ✅ 올바른 매칭:
- 기출: "AI neural implants" ↔ 원문: "AI, brain implants, medical" → 매칭 OK
- 기출: "Bill Traylor paintings" ↔ 원문: "Bill Traylor, art, slavery" → 매칭 OK

### 교과서 3과 vs 4과 구분:
- 3과와 4과는 **완전히 다른 주제**!
- 기출 내용의 주제가 3과 원문 주제와 같으면 → 3과 매칭
- 기출 내용의 주제가 4과 원문 주제와 같으면 → 4과 매칭
- **어느 과와도 내용이 안 맞으면 → external(외부지문)!**

## 연계 유형 판단 기준
- 직접연계(direct): 원문과 거의 동일하고 **단어 몇 개만 변형**됨
- 간접연계(indirect): 원문과 같은 내용이지만 **문장 전체가 패러프레이징**됨
- 외부지문(external): 원문 후보들 중 **일치하는 것을 찾을 수 없음**

## ⚠️ 원문 ID/출처명 작성 규칙 (매우 중요!)
### 모의고사인 경우:
- matched_source_id: "파일명_번호" 형태 (예: "2024년 10월 고1 모의고사_25")
- source_name: "2024년 10월 고1 모의고사 25번" 형태

### 교과서/본문인 경우:
- matched_source_id: "파일명_번호" 형태 (예: "3과_본문_1" 또는 "4과_본문_1")
- source_name: 반드시 "N과" 형태 포함! (예: "교과서 3과 본문", "4과 본문 1번")
- ⚠️ 교과서 파일은 "3과_본문", "4과_본문" 등의 이름을 가짐
- ⚠️ 교과서 내용과 매칭되면 반드시 source_name에 "N과" 패턴 포함!

## JSON으로 반환 (반드시 이 형식으로)
{
  "source_type": "direct/indirect/external",
  "matched_source_id": "원문 ID (위 목록에서 [ID: xxx] 형태로 표시된 값)",
  "source_number": 원문 번호 (숫자만, 예: 18),
  "source_name": "출처명 (예: 2024년 3월 모의고사 18번, 교과서 3과 본문)",
  "confidence": 0-100,
  "reasoning": "매칭 이유"
}

JSON만 반환하세요.`;

    try {
      const response = await callOpenRouter(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = safeJsonParse<Record<string, unknown>>(jsonMatch[0]);
        if (parsed) {
          let matchedSource = allSources.find(s => s.id === parsed.matched_source_id);

          if (!matchedSource && parsed.source_number && parsed.source_name) {
            const srcName = String(parsed.source_name);
            matchedSource = allSources.find(s =>
              s.number === Number(parsed.source_number) &&
              (srcName.includes(s.name) || s.name.includes(srcName) || s.id.toLowerCase().includes(srcName.toLowerCase().replace(/\s+/g, '_')))
            );
          }

          // ID로 매칭 시도
          if (!matchedSource && parsed.matched_source_id) {
            const idStr = String(parsed.matched_source_id);
            matchedSource = allSources.find(s => s.id === idStr || s.id.includes(idStr) || idStr.includes(s.id));
          }

          // 번호로 매칭 (source_number가 있는 경우)
          if (!matchedSource && parsed.source_number) {
            matchedSource = allSources.find(s => s.number === Number(parsed.source_number));
          }

          // source_name에서 번호 추출해서 매칭 (모의고사용)
          if (!matchedSource && parsed.source_name) {
            const sourceName = String(parsed.source_name);
            const numberMatch = sourceName.match(/(\d+)번/);
            if (numberMatch) {
              matchedSource = allSources.find(s => s.number === Number(numberMatch[1]));
            }
          }

          // 교과서/본문 매칭 (N과 패턴)
          if (!matchedSource && parsed.source_name) {
            const sourceName = String(parsed.source_name);
            const isTextbook = /교과서|본문|과_본문|과 본문|Lesson/i.test(sourceName);

            if (isTextbook) {
              const lessonMatch = sourceName.match(/(\d+)과/) || sourceName.match(/Lesson\s*(\d+)/i);
              if (lessonMatch) {
                const lessonNum = lessonMatch[1];
                // 해당 과가 포함된 source 찾기
                matchedSource = allSources.find(s => {
                  const normalizedName = s.name.replace(/[\s_]+/g, '').toLowerCase();
                  return normalizedName.includes(`${lessonNum}과`) || normalizedName.includes(`lesson${lessonNum}`);
                });
                log(`교과서 매칭 시도 (runMatchingOnly): ${lessonNum}과 -> ${matchedSource?.name || '없음'}`);
              }
            }
          }

          // 파일명 직접 비교 (정규화해서)
          if (!matchedSource && parsed.source_name) {
            const sourceName = String(parsed.source_name);
            const normalizedSourceName = sourceName.replace(/[\s_]+/g, '').toLowerCase();

            matchedSource = allSources.find(s => {
              const normalizedName = s.name.replace(/[\s_]+/g, '').toLowerCase();
              return normalizedName.includes(normalizedSourceName.slice(0, 20)) ||
                     normalizedSourceName.includes(normalizedName.slice(0, 20));
            });
          }

          log(`AI 매칭 결과: source_name=${parsed.source_name}, found=${!!matchedSource}`);

          // 🚨🚨🚨 핵심 로직: 유사도 기반 매칭 (AI 결과 무시하고 직접 계산) 🚨🚨🚨
          const SIMILARITY_THRESHOLD = 0.05; // 5% 이상 단어 겹쳐야 매칭 인정

          // 1. 모든 원문과 유사도 계산하여 가장 높은 것 찾기
          const { source: bestSource, similarity: bestSimilarity } = findBestMatchingSource(q.text, allSources);

          log(`\n========== 유사도 기반 매칭: 문제 ${q.number}번 ==========`);
          // 모든 원문 유사도 상세 로깅
          const detailedSimilarities = allSources.map(s => {
            const words1 = normalizeText(q.text);
            const words2 = normalizeText(s.text);
            const set1 = new Set(words1);
            const set2 = new Set(words2);

            // 단어 유사도
            let wordInt = 0;
            for (const w of set1) if (set2.has(w)) wordInt++;
            const wordSim = (set1.size + set2.size - wordInt) > 0 ? wordInt / (set1.size + set2.size - wordInt) : 0;

            // 바이그램
            const bg1 = generateNgrams(words1, 2);
            const bg2 = generateNgrams(words2, 2);
            let bgInt = 0;
            for (const b of bg1) if (bg2.has(b)) bgInt++;
            const bgSim = (bg1.size + bg2.size - bgInt) > 0 ? bgInt / (bg1.size + bg2.size - bgInt) : 0;

            // 트라이그램
            const tg1 = generateNgrams(words1, 3);
            const tg2 = generateNgrams(words2, 3);
            let tgInt = 0;
            for (const t of tg1) if (tg2.has(t)) tgInt++;
            const tgSim = (tg1.size + tg2.size - tgInt) > 0 ? tgInt / (tg1.size + tg2.size - tgInt) : 0;

            // 키워드
            const kw1 = extractKeywords(q.text);
            const kw2 = extractKeywords(s.text);
            let kwInt = 0;
            for (const k of kw1) if (kw2.has(k)) kwInt++;
            const kwSim = Math.min(kw1.size, kw2.size) > 0 ? kwInt / Math.min(kw1.size, kw2.size) : 0;

            const total = wordSim * 0.15 + bgSim * 0.25 + tgSim * 0.30 + kwSim * 0.30;

            return {
              name: s.name,
              total,
              wordSim,
              bgSim,
              tgSim,
              kwSim,
              kwMatched: kwInt,
              kwTotal: kw1.size
            };
          }).sort((a, b) => b.total - a.total);

          detailedSimilarities.forEach((s, i) => {
            log(`  ${i + 1}. ${s.name}: 총합=${(s.total * 100).toFixed(1)}%`);
            log(`     단어=${(s.wordSim * 100).toFixed(1)}%, 2gram=${(s.bgSim * 100).toFixed(1)}%, 3gram=${(s.tgSim * 100).toFixed(1)}%, 키워드=${(s.kwSim * 100).toFixed(1)}% (${s.kwMatched}/${s.kwTotal})`);
          });

          const similarities = detailedSimilarities.slice(0, 3);

          // 2. 유사도 기반 최종 매칭
          let finalSource: typeof allSources[0] | null = null;

          if (bestSource && bestSimilarity >= SIMILARITY_THRESHOLD) {
            if (matchedSource && matchedSource.id !== bestSource.id) {
              const aiSimilarity = calculateSimilarity(q.text, matchedSource.text);
              log(`⚠️ AI 매칭 오류 감지!`);
              log(`   AI가 선택: ${matchedSource.name} (유사도 ${(aiSimilarity * 100).toFixed(1)}%)`);
              log(`   실제 최적: ${bestSource.name} (유사도 ${(bestSimilarity * 100).toFixed(1)}%)`);
            }
            finalSource = bestSource;
          } else {
            log(`❌ 유사한 원문 없음 (최고 유사도: ${(bestSimilarity * 100).toFixed(1)}%) - 외부지문 처리`);
            finalSource = null;
          }

          const finalSourceType = finalSource
            ? (parsed.source_type as 'direct' | 'indirect' | 'external') || 'direct'
            : 'external';

          matches.push({
            questionNumber: q.number,
            questionText: q.text,
            sourceType: finalSourceType,
            sourceName: finalSource ? (finalSource.name.includes('과') ? `교과서 ${finalSource.name}` : finalSource.name) : '외부지문',
            sourceNumber: finalSource?.number || null,
            sourceText: finalSource?.text || '',
            confidence: Math.round(bestSimilarity * 100),
            reasoning: finalSource ? `유사도 ${(bestSimilarity * 100).toFixed(1)}%로 매칭됨` : '유사한 원문 없음',
          });
          continue;
        }
      }
      matches.push({
        questionNumber: q.number,
        questionText: q.text,
        sourceType: 'external',
        sourceName: '외부지문',
        sourceNumber: null,
        sourceText: '',
        confidence: 0,
        reasoning: '매칭 실패',
      });
    } catch (error) {
      matches.push({
        questionNumber: q.number,
        questionText: q.text,
        sourceType: 'external',
        sourceName: '외부지문',
        sourceNumber: null,
        sourceText: '',
        confidence: 0,
        reasoning: `오류: ${error instanceof Error ? error.message : '알 수 없음'}`,
      });
    }
  }

  return matches;
}

export async function runDetailedAnalysis(
  confirmedMatches: ConfirmedMatch[],
  vocabularyLevel: string,
  answerKey: string,
  onProgress?: (step: string, progress: number) => void
): Promise<DetailedAnalysis[]> {
  log('=== 상세 분석 시작 ===');
  log(`정답 정보: ${answerKey || '없음'}`);
  const tepsThreshold = vocabularyLevel === 'teps_870' ? 870 : vocabularyLevel === 'teps_850' ? 850 : 830;
  const results: DetailedAnalysis[] = [];
  
  const answers = answerKey ? answerKey.split(',').map(a => a.trim()) : [];

  for (let i = 0; i < confirmedMatches.length; i++) {
    const match = confirmedMatches[i];
    onProgress?.('상세 분석', ((i + 1) / confirmedMatches.length) * 100);
    
    const correctAnswer = answers[match.questionNumber - 1] || '';
    log(`========================================`);
    log(`문제 ${match.questionNumber}번`);
    log(`- 전체 answerKey: "${answerKey}"`);
    log(`- answers 배열: ${JSON.stringify(answers)}`);
    log(`- 이 문제 정답: "${correctAnswer}" (인덱스: ${match.questionNumber - 1})`);
    log(`========================================`);

    const prompt = match.sourceType === 'external'
      ? createExternalPrompt(match, tepsThreshold, correctAnswer)
      : createLinkedPrompt(match, tepsThreshold, correctAnswer);

    try {
      const response = await callOpenRouter(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = safeJsonParse<Record<string, unknown>>(jsonMatch[0]);
        if (parsed) {
          results.push(parseResult(match, parsed));
        } else {
          log(`문제 ${match.questionNumber} 상세분석 JSON 파싱 실패`);
          results.push(createDefault(match));
        }
      } else {
        results.push(createDefault(match));
      }
    } catch (error) {
      log(`문제 ${match.questionNumber} 상세분석 에러: ${error instanceof Error ? error.message : 'Unknown'}`);
      results.push(createDefault(match));
    }
  }

  return results;
}

function extractUnderlinedWords(text: string): string[] {
  const patterns = [
    /[ⓐⓑⓒⓓⓔⓕⓖⓗ]\s*\*\*([^*]+)\*\*/g,
    /[ⓐⓑⓒⓓⓔⓕⓖⓗ]\s+(\w+)/g,
    /\*\*([^*]+)\*\*/g,
  ];
  
  const words: string[] = [];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      if (match[1] && !words.includes(match[1].trim())) {
        words.push(match[1].trim());
      }
    }
  }
  return words;
}

function createLinkedPrompt(match: ConfirmedMatch, tepsThreshold: number, correctAnswer: string): string {
  const answerWarning = correctAnswer 
    ? `
###########################################
# 🚨 이 문제의 정답: ${correctAnswer}번 (확정)
# 정답을 절대 변경하지 마세요!
# answer_rationale: "${correctAnswer}번이 정답인 이유" 설명
# wrong_answer_analysis: ${correctAnswer}번 제외한 나머지만 오답 분석
###########################################
` 
    : '';
  
  const underlinedWords = extractUnderlinedWords(match.questionText);
  const underlinedInfo = underlinedWords.length > 0 
    ? `\n## 기출문제 밑줄 단어 (어법/어휘용): ${underlinedWords.join(', ')}`
    : '';
  
  return `${answerWarning}
당신은 영어 내신 기출문제 해설지를 작성하는 전문가입니다.

## 기출문제 ${match.questionNumber}번
${match.questionText}
${underlinedInfo}

## 원문 (${match.sourceName})
${match.sourceText}

## 연계 유형: ${match.sourceType === 'direct' ? '직접연계' : '간접연계'}

## 🚨🚨🚨 가장 중요한 원칙 🚨🚨🚨

### 원문 vs 기출문제 지문 용도 구분
| 항목 | 사용할 텍스트 | 설명 |
|------|---------------|------|
| **정답 근거 (answer_rationale)** | 기출문제 지문 | 학생이 보는 건 기출문제! |
| **오답 분석 (wrong_answer_analysis)** | 기출문제 지문 | 기출문제 지문에서 근거 찾기 |
| **변형 패턴 (transformation_summary)** | 원문 → 기출 비교 | 어떻게 변형됐는지 |
| **문장 비교 (sentence_comparisons)** | 원문 → 기출 비교 | 구체적 문장 변형 |
| **어휘 변화 (vocabulary_changes)** | 원문 → 기출 비교 | 바뀐 단어들 |

### ⚠️ 절대 규칙
- **해설지(정답/오답 분석)는 100% 기출문제 지문 기반!**
- 원문은 "이 기출문제가 어디서 왔는지" 보여주는 용도만!
- 원문을 정답/오답 판단의 근거로 사용 금지!

### 📌 복합지문 처리 ([5-7], [5~7] 등)
복합지문: 하나의 지문에 여러 문제(보통 2-3개)가 딸려 있는 형태
- 예: [5-7]이면 5번, 6번, 7번이 **같은 지문** 공유
- 각 문제는 **자기 문제 유형에 맞는 분석만** 수행!
- 예시:
  - 5번(순서배열) → 순서 논리만 분석, 어법 분석 X
  - 6번(내용일치) → 지문과 선택지 비교만
  - 7번(어법) → 여기서만 grammar_points로 어법 분석!

## 문제 유형별 분석 규칙 (해설지 작성)
⚠️ 모든 유형에서 answer_rationale, wrong_answer_analysis는 **기출문제 지문**에서 근거를 찾으세요!
⚠️ **grammar_points는 어법/어휘 문제에서만 사용! 다른 유형은 빈 배열 []!**

### 1. 빈칸추론 문제 (빈칸에 들어갈 말)
- grammar_points는 빈 배열 []로 반환
- answer_rationale에 "왜 정답이 정답인지" 상세 설명:
  - 빈칸 앞뒤 문맥 분석
  - 정답 선택지가 왜 적절한지
  - 오답 선택지들이 왜 부적절한지

### 2. 어법 문제 (밑줄 친 부분 중 어법상 틀린 것)
⚠️ **어법 문제만 grammar_points 사용! 다른 유형은 빈 배열 []!**
⚠️ 기출문제 텍스트에서 밑줄 친 단어만 분석! (원문/교과서 아님!)

🚨🚨🚨 **복합지문 어법 문제 - 가장 중요한 규칙!** 🚨🚨🚨
- 복합지문([5-7] 등)의 어법 문제는 **지문에 실제로 있는 원문자(ⓐⓑⓒⓓⓔⓕⓖ)만** 분석!
- 지문에 없는 단어/문법을 절대 분석하지 마세요!
- 각 grammar_point의 choice_number는 반드시 지문의 원문자와 일치해야 함
- 예: 지문에 ⓐcame, ⓑunnoticed, ⓒwonder... 가 있으면 이것만 분석!
- 예: 지문에 없는 making, holding, taking 같은 단어 분석 금지!
- **체크리스트**: grammar_points 작성 전 지문에서 원문자 목록 확인!

**is_correct 의미 (매우 중요!):**
- 어법 문제는 "틀린 것"을 찾는 문제임
- is_correct: true = **이 항목이 정답** = **어법상 틀린 것** (고쳐야 함)
- is_correct: false = 이 항목은 오답 = 어법상 맞는 것 (그대로 OK)

**예시:** 지문에 ⓐcame, ⓑunnoticed, ⓒwonder, ⓓfeeling이 있고 정답이 ⓒ라면
- ⓐ came → is_correct: false (문법 맞음, 오답)
- ⓑ unnoticed → is_correct: false (문법 맞음, 오답)  
- ⓒ wonder → is_correct: true (문법 틀림! 정답! to wonder가 되어야 함)
- ⓓ feeling → is_correct: false (문법 맞음, 오답)
(⚠️ 지문에 없는 ⓔ, ⓕ 등은 분석하지 않음!)

### 2-1. ⭐⭐⭐ "있는 대로 고르기" 어법 문제 (매우 중요!)
**문제 형태:** "밑줄 친 ⓐ~ⓖ 중, 어법상 **틀린 것만을 있는 대로** 고른 것은?"
**선택지 형태:** ① ⓐ, ⓑ, ⓒ  ② ⓐ, ⓓ, ⓔ  ③ ⓒ, ⓓ, ⓔ, ⓖ ...

🚨 이 유형은 일반 어법 문제와 완전히 다릅니다!
- 일반 어법: 하나만 틀림 (정답=틀린 것 1개)
- 고르기 어법: **여러 개가 틀림** (정답 선택지에 포함된 것들이 모두 틀림!)

**분석 방법:**
1. 정답 선택지 확인 (예: ③번이 정답이면 ③번에 포함된 ⓒ, ⓓ, ⓔ, ⓖ가 틀린 것들)
2. grammar_points에 **지문의 모든 원문자(ⓐ~ⓖ)를 분석**
3. 정답 선택지에 포함된 원문자 → is_correct: true (어법상 틀림)
4. 정답 선택지에 없는 원문자 → is_correct: false (어법상 맞음)

**예시:** 지문에 ⓐ~ⓖ가 있고, 정답이 ③ (ⓒ, ⓓ, ⓔ, ⓖ)라면:
- ⓐ came → is_correct: false, "완전도치 구문에서 주어 the coach 앞에 동사 came이 오는 것은 맞음"
- ⓑ unnoticed → is_correct: false, "go unnoticed는 '눈에 띄지 않다'로 형용사 unnoticed가 보어로 쓰임"
- ⓒ wonder → is_correct: true, "had no choice but to V 구문이므로 to wonder가 되어야 함"
- ⓓ feeling → is_correct: true, "지각동사 felt 뒤에 목적격보어로 현재분사 feeling 대신 원형 feel이 와야 함"
- ⓔ which → is_correct: true, "선행사 the possibility 뒤에 동격절이므로 which 대신 that이 와야 함"
- ⓕ collapsed → is_correct: false, "no sooner ~ than 구문에서 과거완료 had 다음에 p.p. collapsed는 맞음"
- ⓖ drawing → is_correct: true, "was drawing to a close에서 시제가 맞지 않아 drew가 되어야 함"

**wrong_answer_analysis에서:**
- 각 오답 선택지가 왜 틀린지 설명 (포함된 원문자 중 실제로 맞는 것이 있거나, 틀린 것이 누락됨)

### 3. 문장삽입 문제 (주어진 문장이 들어갈 위치)
- grammar_points는 빈 배열 []로 반환
- answer_rationale에:
  - 주어진 문장의 핵심 연결고리 (지시어, 접속사 등)
  - 왜 그 위치 앞뒤 문맥과 연결되는지

### 4. 순서배열 문제 ((A)-(B)-(C)-(D) 문단 순서 배열)
🚨 **grammar_points는 반드시 빈 배열 []로 반환!** (어법 분석 절대 금지!)
- 복합지문([5-7] 등)에서 밑줄 표시(ⓐⓑⓒ...)가 있어도 순서배열에서는 어법 분석 안 함!
- 밑줄 어법 분석은 별도의 어법 문제(예: 7번)에서만!
- answer_rationale에 올바른 순서의 논리적 흐름만 설명:
  - (A) 다음에 왜 특정 문단이 오는지
  - 각 문단의 연결고리 (지시어, 접속사, 논리적 흐름)

### 5. 어휘 문제 (문맥상 적절하지 않은 것)
🚨 **grammar_points에 반드시 5개 항목!** (① ② ③ ④ ⑤)
- 어휘 문제는 항상 5개의 밑줄 단어가 있음
- grammar_points 배열에 5개 모두 분석! 4개만 하면 안 됨!
- choice_number: "①", "②", "③", "④", "⑤" 형식
- 정답(부적절한 어휘): is_correct = true, 왜 문맥에 안 맞는지 + 올바른 어휘 제시
- 오답(적절한 어휘): is_correct = false, 왜 문맥에 적절한지 설명

### 6. 무관한 문장 문제 (글의 흐름과 관계 없는 문장)
- grammar_points는 빈 배열 []로 반환
- answer_rationale에:
  - 글 전체의 주제/흐름이 무엇인지
  - 정답 문장이 왜 이 흐름과 무관한지 (다른 주제, 논리적 단절 등)
  - 나머지 문장들은 어떻게 흐름에 기여하는지

### 7. 주제/요지/제목/요약문 문제
- grammar_points는 빈 배열 []로 반환
- answer_rationale에:
  - 글의 핵심 주장/메시지
  - 왜 정답 선택지가 이를 가장 잘 표현하는지

### 8. 내용일치/불일치 문제 (⭐⭐⭐ 매우 중요!)
🚨🚨🚨 **기출문제 지문과 비교! 원문(교과서/모의고사)이 아님!** 🚨🚨🚨

**핵심 원칙:**
- 학생이 보는 것은 **기출문제 지문**임 (원문 아님!)
- 따라서 선택지는 **기출문제 지문**과 비교해야 함
- 원문(교과서/모의고사)은 변형 분석용일 뿐, 정답 판단 근거가 아님!

**분석 원칙:**
- 각 선택지를 **기출문제 지문**과 **단어 단위로** 비교
- 반드시 **기출문제 지문의 실제 문장을 인용**하여 근거 제시
- 추측이나 해석 금지 - 지문에 명시된 내용만 사용

**answer_rationale 필수 형식:**
- "정답은 N번입니다."
- "지문: '[기출문제 지문에서 관련 문장 그대로 인용]'"
- "선택지: '[선택지 내용]'"
- "불일치 이유: 지문에서는 'A'라고 했는데, 선택지에서는 'B'라고 하여 일치하지 않음"

**wrong_answer_analysis 필수 형식 (일치하는 선택지들):**
- "지문: '[기출문제 지문에서 해당 내용 그대로 인용]' → 선택지와 일치함"

**예시 (불일치 문제):**
- 정답 분석: "지문: 'The coach called him after the game.' 선택지: 'right after the game'이라고 했는데, 지문에는 'right'가 없음. 단순히 'after'라고만 되어 있어 '경기 직후'라고 단정할 수 없음"
- 오답 분석: "지문: 'He had long hoped to be recognized as the team's leader.' → ③번 선택지와 정확히 일치함"

**⚠️ 금지 사항:**
- 원문(교과서/모의고사)을 근거로 사용 금지! 기출문제 지문만 사용!
- "~일 수도 있다", "~로 추측된다" 등 추측 금지
- 지문에 없는 내용을 근거로 사용 금지
- 문맥 해석으로 내용을 유추하여 판단 금지

## ⭐⭐⭐ 오답 분석 (필수! 절대 생략 금지!)
**wrong_answer_analysis는 반드시 정답을 제외한 모든 오답 선택지(보통 4개)를 분석해야 합니다.**
**빈 배열 [] 절대 금지! 오답 분석 없으면 해설지로서 가치 없음!**

### 빈칸추론 문제 오답 분석 예시
1. **반대 의미**: "①번 'at a cost of not seeing...'은 'not'이 포함되어 정답과 정반대 의미. 글은 추상화의 대가로 현실을 있는 그대로 못 본다고 하는데, 이 선택지는 현실을 있는 그대로 보지 않는 것의 대가라고 하여 논리가 뒤바뀜"
2. **문맥 불일치**: "③번은 빈칸 뒤 문장 'Instead, we see the world through our assumptions'와 연결되지 않음"
3. **부분적 일치**: "④번은 글의 일부 내용만 반영하고 핵심 논지인 '~'를 놓침"
4. **주제 이탈**: "⑤번의 '~'는 글에서 전혀 다루지 않는 개념"

### 제목/요지/주제/요약문 문제 오답 분석
1. **핵심소재 미반영**: "글의 핵심 소재인 '~'가 선택지에 없음"
2. **범위 과대/과소**: "글은 'A'만 다루는데, 선택지는 너무 넓거나 좁음"
3. **논점 이탈**: "글의 주장 방향과 다른 주장"

### 어법 문제 오답 분석
- 각 선택지가 왜 문법적으로 **맞는지** 설명 (틀린 것을 찾는 문제이므로)

### 어휘 문제 오답 분석  
- 각 선택지가 왜 문맥상 **적절한지** 설명 (부적절한 것을 찾는 문제이므로)

## 어휘 변형 분석 (모든 유형 공통)
- 원문에서 기출로 바뀐 어휘가 있으면:
  - original: 원문의 단어
  - transformed: 기출의 단어  
  - original_context: "원문에서 '~' 문장에서 사용됨"
  - transformed_context: "기출에서 '~' 문장으로 변형됨"

## JSON 반환

**[변형 분석용 필드]** - 원문 vs 기출 비교:
- sentence_comparisons, vocabulary_changes, transformation_summary

**[해설용 필드]** - 🚨 100% 기출문제 지문 기반! 원문 사용 금지!:
- answer_rationale, wrong_answer_analysis, grammar_points

{
  "question_type": "빈칸추론/어법/문장삽입/순서배열/어휘/무관한문장/주제/요지/제목/내용일치 등",
  "difficulty": "high/medium/low",
  "sentence_comparisons": [
    {
      "original": "원문의 문장",
      "transformed": "기출에서 변형된 문장",
      "change_type": "어순변경/어휘대체/문장축약/문장결합 등",
      "explanation": "변형 설명"
    }
  ],
  "vocabulary_changes": [],
  "transformation_summary": "원문→기출 변형 패턴 설명",
  "grammar_points": [],
  "wrong_answer_analysis": [
    {"choice": "①", "reason": "기출지문: '...' → 선택지와 불일치/일치 이유"},
    {"choice": "②", "reason": "기출지문: '...' → 선택지와 불일치/일치 이유"}
  ],
  "answer_rationale": "정답은 N번. 기출지문: '...' 선택지: '...' 따라서...",
  "teacher_intent": "출제 의도",
  "study_tips": ["팁1", "팁2"]
}

⚠️ wrong_answer_analysis 필수 규칙:
- 정답 제외 모든 오답(보통 4개)을 분석
- 각 항목에 "choice"(①②③④⑤ 중 하나)와 "reason"(상세 설명) 필수
- reason은 절대 빈 문자열 금지! 최소 한 문장 이상 설명

🚨🚨🚨 마지막 확인 🚨🚨🚨
- answer_rationale 첫 문장: "정답은 N번입니다" (N = 위에서 제공된 정답)
- wrong_answer_analysis: 정답 N번 제외, 나머지만 분석
- 정답을 절대 변경하지 마세요!

JSON만 반환하세요.`;
}

function createExternalPrompt(match: ConfirmedMatch, tepsThreshold: number, correctAnswer: string): string {
  const answerWarning = correctAnswer 
    ? `
###########################################
# 🚨 이 문제의 정답: ${correctAnswer}번 (확정)
# 정답을 절대 변경하지 마세요!
# answer_rationale: "${correctAnswer}번이 정답인 이유" 설명
# wrong_answer_analysis: ${correctAnswer}번 제외한 나머지만 오답 분석
###########################################
` 
    : '';
  
  const underlinedWords = extractUnderlinedWords(match.questionText);
  const underlinedInfo = underlinedWords.length > 0 
    ? `\n## 기출문제 밑줄 단어 (어법/어휘용): ${underlinedWords.join(', ')}`
    : '';
  
  return `${answerWarning}
당신은 영어 내신 기출문제 해설지를 작성하는 전문가입니다.

## 외부지문 문제 ${match.questionNumber}번
${match.questionText}
${underlinedInfo}

## 🚨🚨🚨 가장 중요한 원칙 🚨🚨🚨

### ⚠️ 절대 규칙
- **해설지(정답/오답 분석)는 100% 기출문제 지문 기반!**
- 외부지문이므로 원문이 없음 → 기출문제 지문만 보고 분석
- answer_rationale, wrong_answer_analysis 모두 **기출문제 지문**에서 근거 찾기
- 어법/어휘 분석은 기출문제에서 ⓐⓑⓒⓓⓔⓕⓖ 또는 **단어** 형태로 표시된 것만!

### 📌 복합지문 처리 ([5-7], [5~7] 등)
복합지문: 하나의 지문에 여러 문제(보통 2-3개)가 딸려 있는 형태
- 예: [5-7]이면 5번, 6번, 7번이 **같은 지문** 공유
- 각 문제는 **자기 문제 유형에 맞는 분석만** 수행!
- 예시:
  - 5번(순서배열) → 순서 논리만 분석, 어법 분석 X
  - 6번(내용일치) → 지문과 선택지 비교만
  - 7번(어법) → 여기서만 grammar_points로 어법 분석!

## 문제 유형별 분석 규칙 (해설지 작성)
⚠️ 모든 유형에서 answer_rationale, wrong_answer_analysis는 **기출문제 지문**에서 근거를 찾으세요!
⚠️ **grammar_points는 어법/어휘 문제에서만 사용! 다른 유형은 빈 배열 []!**

### 1. 빈칸추론 문제 (빈칸에 들어갈 말)
- grammar_points는 빈 배열 []로 반환
- answer_rationale에 "왜 정답이 정답인지" 상세 설명 (**기출문제 지문 인용!**):
  - 빈칸 앞뒤 문맥 분석
  - 정답 선택지가 왜 적절한지
  - 오답 선택지들이 왜 부적절한지

### 2. 어법 문제 (밑줄 친 부분 중 어법상 틀린 것)
⚠️ **어법 문제만 grammar_points 사용! 다른 유형은 빈 배열 []!**
⚠️ 기출문제 텍스트에서 밑줄 친 단어만 분석!

🚨🚨🚨 **복합지문 어법 - 절대 규칙!** 🚨🚨🚨
- **지문에 실제로 있는 원문자(ⓐⓑⓒⓓⓔⓕⓖ)와 해당 단어만 분석!**
- 지문에 없는 문법/단어를 절대 만들어내지 마세요!
- grammar_points 작성 전: "지문에서 ⓐ~ⓖ 중 어떤 것들이 있는지" 먼저 확인!
- 예: 지문에 ⓐcame, ⓑunnoticed, ⓒwonder, ⓓfeeling, ⓔwhich, ⓕcollapsed, ⓖdrawing 가 있으면, 이 7개만 분석!
- 지문에 없는 making, holding, taking 등 다른 단어 분석 금지!

**is_correct 의미 (매우 중요!):**
- 어법 문제는 "틀린 것"을 찾는 문제임
- is_correct: true = **이 항목이 정답** = **어법상 틀린 것** (고쳐야 함)
- is_correct: false = 이 항목은 오답 = 어법상 맞는 것 (그대로 OK)

**예시:** 지문에 ⓐcame, ⓑunnoticed, ⓒwonder, ⓓfeeling이 있고 정답이 ⓒ라면
- ⓐ came → is_correct: false (문법 맞음, 오답)
- ⓑ unnoticed → is_correct: false (문법 맞음, 오답)
- ⓒ wonder → is_correct: true (문법 틀림! 정답! to wonder가 되어야 함)
- ⓓ feeling → is_correct: false (문법 맞음, 오답)
(지문에 없는 단어는 절대 분석하지 않음!)

### 2-1. ⭐⭐⭐ "있는 대로 고르기" 어법 문제 (매우 중요!)
**문제 형태:** "밑줄 친 ⓐ~ⓖ 중, 어법상 **틀린 것만을 있는 대로** 고른 것은?"
**선택지 형태:** ① ⓐ, ⓑ, ⓒ  ② ⓐ, ⓓ, ⓔ  ③ ⓒ, ⓓ, ⓔ, ⓖ ...

🚨 이 유형은 일반 어법 문제와 완전히 다릅니다!
- 일반 어법: 하나만 틀림 (정답=틀린 것 1개)
- 고르기 어법: **여러 개가 틀림** (정답 선택지에 포함된 것들이 모두 틀림!)

**분석 방법:**
1. 정답 선택지 확인 (예: ③번이 정답이면 ③번에 포함된 ⓒ, ⓓ, ⓔ, ⓖ가 틀린 것들)
2. grammar_points에 **지문의 모든 원문자(ⓐ~ⓖ)를 분석**
3. 정답 선택지에 포함된 원문자 → is_correct: true (어법상 틀림)
4. 정답 선택지에 없는 원문자 → is_correct: false (어법상 맞음)

**예시:** 지문에 ⓐ~ⓖ가 있고, 정답이 ③ (ⓒ, ⓓ, ⓔ, ⓖ)라면:
- ⓐ came → is_correct: false, "완전도치 구문 정상"
- ⓑ unnoticed → is_correct: false, "go unnoticed 형용사 보어 정상"
- ⓒ wonder → is_correct: true, "had no choice but to V이므로 to wonder가 되어야 함"
- ⓓ feeling → is_correct: true, "지각동사 felt 뒤 원형부정사 feel이 와야 함"
- ⓔ which → is_correct: true, "동격절이므로 which 대신 that이 와야 함"
- ⓕ collapsed → is_correct: false, "no sooner than 구문 정상"
- ⓖ drawing → is_correct: true, "시제 불일치로 drew가 되어야 함"

### 3. 문장삽입 문제 (주어진 문장이 들어갈 위치)
- grammar_points는 빈 배열 []로 반환
- answer_rationale에:
  - 주어진 문장의 핵심 연결고리 (지시어, 접속사 등)
  - 왜 그 위치 앞뒤 문맥과 연결되는지

### 4. 순서배열 문제 ((A)-(B)-(C)-(D) 문단 순서 배열)
🚨 **grammar_points는 반드시 빈 배열 []로 반환!** (어법 분석 절대 금지!)
- 복합지문([5-7] 등)에서 밑줄 표시(ⓐⓑⓒ...)가 있어도 순서배열에서는 어법 분석 안 함!
- 밑줄 어법 분석은 별도의 어법 문제에서만!
- answer_rationale에 올바른 순서의 논리적 흐름만 설명:
  - (A) 다음에 왜 특정 문단이 오는지
  - 각 문단의 연결고리 (지시어, 접속사, 논리적 흐름)

### 5. 어휘 문제 (문맥상 적절하지 않은 것)
🚨 **grammar_points에 반드시 5개 항목!** (① ② ③ ④ ⑤)
- 어휘 문제는 항상 5개의 밑줄 단어가 있음
- grammar_points 배열에 5개 모두 분석! 4개만 하면 안 됨!
- choice_number: "①", "②", "③", "④", "⑤" 형식
- 정답(부적절한 어휘): is_correct = true, 왜 문맥에 안 맞는지 + 올바른 어휘 제시
- 오답(적절한 어휘): is_correct = false, 왜 문맥에 적절한지 설명

### 6. 무관한 문장 문제 (글의 흐름과 관계 없는 문장)
- grammar_points는 빈 배열 []로 반환
- answer_rationale에:
  - 글 전체의 주제/흐름이 무엇인지
  - 정답 문장이 왜 이 흐름과 무관한지 (다른 주제, 논리적 단절 등)
  - 나머지 문장들은 어떻게 흐름에 기여하는지

### 7. 주제/요지/제목/요약문 문제
- grammar_points는 빈 배열 []로 반환
- answer_rationale에:
  - 글의 핵심 주장/메시지
  - 왜 정답 선택지가 이를 가장 잘 표현하는지

### 8. 내용일치/불일치 문제 (⭐⭐⭐ 매우 중요!)
🚨🚨🚨 **기출문제 지문과 비교! 원문(교과서/모의고사)이 아님!** 🚨🚨🚨

**핵심 원칙:**
- 학생이 보는 것은 **기출문제 지문**임 (원문 아님!)
- 따라서 선택지는 **기출문제 지문**과 비교해야 함
- 원문(교과서/모의고사)은 출처 확인용일 뿐, 정답 판단 근거가 아님!

**분석 원칙:**
- 각 선택지를 **기출문제 지문**과 **단어 단위로** 비교
- 반드시 **기출문제 지문의 실제 문장을 인용**하여 근거 제시
- 추측이나 해석 금지 - 지문에 명시된 내용만 사용

**answer_rationale 필수 형식:**
- "정답은 N번입니다."
- "지문: '[기출문제 지문에서 관련 문장 그대로 인용]'"
- "선택지: '[선택지 내용]'"
- "불일치 이유: 지문에서는 'A'라고 했는데, 선택지에서는 'B'라고 하여 일치하지 않음"

**wrong_answer_analysis 필수 형식 (일치하는 선택지들):**
- "지문: '[기출문제 지문에서 해당 내용 그대로 인용]' → 선택지와 일치함"

**예시 (불일치 문제):**
- 정답 분석: "지문: 'The coach called him after the game.' 선택지: 'right after the game'이라고 했는데, 지문에는 'right'가 없음. 단순히 'after'라고만 되어 있어 '경기 직후'라고 단정할 수 없음"
- 오답 분석: "지문: 'He had long hoped to be recognized as the team's leader.' → ③번 선택지와 정확히 일치함"

**⚠️ 금지 사항:**
- 원문(교과서/모의고사)을 근거로 사용 금지! 기출문제 지문만 사용!
- "~일 수도 있다", "~로 추측된다" 등 추측 금지
- 지문에 없는 내용을 근거로 사용 금지
- 문맥 해석으로 내용을 유추하여 판단 금지

## ⭐ 오답 분석 (매우 중요! - 교육철학)
정답뿐 아니라 **오답이 왜 오답인지** 반드시 분석하세요.

### 모든 문제 유형 공통
- wrong_answer_analysis에 각 오답 선택지별 분석 제공
- 학생이 "왜 이건 틀렸지?"라는 의문을 해소할 수 있도록

### 특히 제목/요지/주제/요약문 문제에서 (매우 상세히!)
오답의 흔한 패턴을 구체적으로 지적:
1. **핵심소재 미반영**: "이 선택지는 글의 핵심 소재인 '~'를 포함하지 않음"
2. **범위 과대**: "이 선택지는 글의 범위보다 너무 포괄적임 (글은 'A'만 다루는데, 선택지는 'A와 B 전체'를 언급)"
3. **범위 과소**: "이 선택지는 글의 일부만 다루고 전체 주제를 놓침"
4. **관련 없는 어휘**: "이 선택지의 '~' 어휘는 글에서 다루지 않는 개념임"
5. **논점 이탈**: "글의 주장과 다른 방향의 주장을 담고 있음"

### 빈칸추론/어휘 문제에서
- 각 오답이 왜 문맥상 부적절한지 구체적 설명

## JSON 반환
{
  "question_type": "빈칸추론/어법/문장삽입/순서배열/어휘/무관한문장/주제/요지/제목/내용일치 등",
  "difficulty": "high/medium/low",
  "vocabulary_changes": [],
  "grammar_points": [
    {
      "choice_number": "ⓐ",
      "content": "밑줄 친 단어/구문",
      "grammatical_focus": "시제/태/분사/관계사 등",
      "is_correct": false,
      "explanation": "어법 설명 (최소 2문장)"
    }
  ],
  "wrong_answer_analysis": [
    {"choice": "①", "reason": "오답인 이유를 상세히 설명..."},
    {"choice": "②", "reason": "오답인 이유를 상세히 설명..."},
    {"choice": "③", "reason": "오답인 이유를 상세히 설명..."},
    {"choice": "⑤", "reason": "오답인 이유를 상세히 설명..."}
  ],
  "teacher_intent": "출제 의도 (최소 2문장)",
  "answer_rationale": "⭐ 정답 N번이 정답인 이유 (최소 3문장)",
  "study_tips": ["학습 팁 1", "학습 팁 2"]
}

⚠️ 필수 규칙 (빈 문자열 절대 금지!):
- 정답 제외 모든 오답(보통 4개)을 분석
- 각 항목에 "choice"(①②③④⑤ 중 하나)와 "reason"(상세 설명) 필수
- reason은 절대 빈 문자열 금지! 최소 한 문장 이상 설명

🚨🚨🚨 마지막 확인 🚨🚨🚨
- answer_rationale 첫 문장: "정답은 N번입니다" (N = 위에서 제공된 정답)
- wrong_answer_analysis: 정답 N번 제외, 나머지만 분석
- 정답을 절대 변경하지 마세요!

JSON만 반환하세요.`;
}

function parseResult(match: ConfirmedMatch, parsed: Record<string, unknown>): DetailedAnalysis {
  return {
    questionNumber: match.questionNumber,
    questionText: match.questionText,
    sourceType: match.sourceType,
    sourceName: match.sourceName,
    questionType: (parsed.question_type as string) || '기타',
    originalType: parsed.original_type as string | undefined,
    difficulty: (parsed.difficulty as 'high' | 'medium' | 'low') || 'medium',
    sentenceComparisons: ((parsed.sentence_comparisons as Array<Record<string, string>>) || [])
      .map(s => ({
        original: s.original || '',
        transformed: s.transformed || '',
        changeType: s.change_type || '',
        explanation: s.explanation || '',
      }))
      .filter(s => s.original && s.transformed),
    vocabularyChanges: ((parsed.vocabulary_changes as Array<Record<string, unknown>>) || []).map(v => ({
      original: (v.original as string) || '',
      transformed: (v.transformed as string) || '',
      originalContext: (v.original_context as string) || '',
      transformedContext: (v.transformed_context as string) || '',
      tepsLevel: (v.teps_level as number) || 0,
    })),
    grammarPoints: ((parsed.grammar_points as Array<Record<string, unknown>>) || [])
      .map(g => ({
        choiceNumber: String(g.choice_number || ''),
        content: (g.content as string) || '',
        grammaticalFocus: (g.grammatical_focus as string) || '',
        isCorrect: (g.is_correct as boolean) || false,
        explanation: (g.explanation as string) || '',
      }))
      .filter(g => g.choiceNumber && g.content && g.explanation),
    wrongAnswerAnalysis: ((parsed.wrong_answer_analysis as Array<Record<string, string>>) || [])
      .map(w => ({
        choice: w.choice || '',
        reason: w.reason || '',
      }))
      .filter(w => w.choice && w.reason),
    transformationSummary: (parsed.transformation_summary as string) || '',
    teacherIntent: (parsed.teacher_intent as string) || '',
    answerRationale: (parsed.answer_rationale as string) || '',
    studyTips: (parsed.study_tips as string[]) || [],
  };
}

function createDefault(match: ConfirmedMatch): DetailedAnalysis {
  return {
    questionNumber: match.questionNumber,
    questionText: match.questionText,
    sourceType: match.sourceType,
    sourceName: match.sourceName,
    questionType: '기타',
    difficulty: 'medium',
    sentenceComparisons: [],
    vocabularyChanges: [],
    grammarPoints: [],
    wrongAnswerAnalysis: [],
    transformationSummary: '',
    teacherIntent: '',
    answerRationale: '',
    studyTips: [],
  };
}
