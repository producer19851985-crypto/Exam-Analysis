import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

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
const geminiForPDF = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', safetySettings });

function log(message: string, data?: unknown) {
  console.log(`[Analyzer] ${message}`, data !== undefined ? JSON.stringify(data, null, 2) : '');
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
    choiceNumber: number;
    content: string;
    grammaticalFocus: string;
    isCorrect: boolean;
    explanation: string;
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

  const questions = JSON.parse(jsonMatch[0]) as ExtractedQuestion[];
  log(`${questions.length}개 문제 추출 완료`);
  return questions;
}

export async function extractSourcesFromPDF(pdfBase64: string): Promise<ExtractedSource[]> {
  log('원문 PDF OCR 시작...');

  const prompt = `이 PDF는 영어 모의고사 또는 교과서입니다.

각 지문을 추출해주세요:
1. 문제 번호가 있으면 번호와 함께
2. 지문 전체 텍스트

JSON 배열로 반환:
[{"number": 18, "text": "지문 전체 텍스트"}, ...]

번호가 없으면 순서대로 1, 2, 3...
JSON만 반환하세요.`;

  try {
    const result = await geminiForPDF.generateContent([
      prompt,
      { inlineData: { mimeType: 'application/pdf', data: pdfBase64 } },
    ]);

    const responseText = result.response.text();
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const sources = JSON.parse(jsonMatch[0]) as ExtractedSource[];
    log(`${sources.length}개 원문 추출 완료`);
    return sources;
  } catch (error) {
    log('원문 추출 오류', error);
    return [];
  }
}

export async function runMatchingAnalysis(
  examPdfBase64: string,
  sourcePdfs: Array<{ name: string; base64: string }>,
  onProgress?: (step: string, progress: number) => void
): Promise<{
  questions: ExtractedQuestion[];
  sources: Array<{ name: string; texts: ExtractedSource[] }>;
  matches: MatchResult[];
}> {
  log('=== 매칭 분석 시작 ===');
  onProgress?.('PDF 분석', 0);

  const questions = await extractQuestionsFromPDF(examPdfBase64);
  onProgress?.('PDF 분석', 30);

  const sources: Array<{ name: string; texts: ExtractedSource[] }> = [];
  for (let i = 0; i < sourcePdfs.length; i++) {
    const texts = await extractSourcesFromPDF(sourcePdfs[i].base64);
    sources.push({ name: sourcePdfs[i].name, texts });
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
    const sourcesFormatted = sources
      .flatMap(s => s.texts.map(t => `[${s.name} ${t.number}번]\n${t.text.substring(0, 500)}...`))
      .join('\n\n---\n\n');

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      onProgress?.('매칭 분석', 60 + ((i + 1) / questions.length) * 40);

      const prompt = `당신은 영어 내신 기출문제 분석 전문가입니다.

## 기출문제 ${q.number}번
${q.text.substring(0, 1000)}

## 원문 후보들
${sourcesFormatted}

## 판단 기준
- 직접연계(direct): 문장 구조 70%+ 유사, 패러프레이징
- 간접연계(indirect): 핵심 소재만 차용, 대부분 변형
- 외부지문(external): 원문에 없음

## JSON으로 반환
{
  "source_type": "direct/indirect/external",
  "source_name": "출처명만 (예: 2024년 3월 모의고사, 교과서 Lesson 3 등)",
  "source_number": 18,
  "confidence": 0-100,
  "reasoning": "판단 근거 (2-3문장)"
}

source_name에는 출처명만, source_number에는 문항 번호만 적으세요.

JSON만 반환하세요.`;

      try {
        const response = await callOpenRouter(prompt);
        const jsonMatch = response.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const sourceText = sources
            .flatMap(s => s.texts)
            .find(t => t.number === parsed.source_number)?.text || '';

          const fullSourceName = parsed.source_number 
            ? `${parsed.source_name || '원문'} ${parsed.source_number}번`
            : parsed.source_name || '외부지문';

          matches.push({
            questionNumber: q.number,
            questionText: q.text,
            sourceType: parsed.source_type || 'external',
            sourceName: fullSourceName,
            sourceNumber: parsed.source_number || null,
            sourceText,
            confidence: parsed.confidence || 0,
            reasoning: parsed.reasoning || '',
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

export async function runDetailedAnalysis(
  confirmedMatches: ConfirmedMatch[],
  vocabularyLevel: string,
  onProgress?: (step: string, progress: number) => void
): Promise<DetailedAnalysis[]> {
  log('=== 상세 분석 시작 ===');
  const tepsThreshold = vocabularyLevel === 'teps_870' ? 870 : vocabularyLevel === 'teps_850' ? 850 : 830;
  const results: DetailedAnalysis[] = [];

  for (let i = 0; i < confirmedMatches.length; i++) {
    const match = confirmedMatches[i];
    onProgress?.('상세 분석', ((i + 1) / confirmedMatches.length) * 100);

    const prompt = match.sourceType === 'external'
      ? createExternalPrompt(match, tepsThreshold)
      : createLinkedPrompt(match, tepsThreshold);

    try {
      const response = await callOpenRouter(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        results.push(parseResult(match, parsed));
      } else {
        results.push(createDefault(match));
      }
    } catch (error) {
      results.push(createDefault(match));
    }
  }

  return results;
}

function createLinkedPrompt(match: ConfirmedMatch, tepsThreshold: number): string {
  return `당신은 영어 내신 기출문제 분석 전문가입니다.

## 기출문제 ${match.questionNumber}번
${match.questionText}

## 원문 (${match.sourceName})
${match.sourceText}

## 연계 유형: ${match.sourceType === 'direct' ? '직접연계' : '간접연계'}

## 분석 요청 (반드시 위 텍스트만 기반으로)
1. 문장 비교: 원문→변형
2. 어휘 변형: TEPS ${tepsThreshold}+ (텍스트에 있는 것만)
3. 문법 포인트 (어법 문제시 - 아래 중요 규칙 참고)
4. 변형 패턴, 출제 의도, 정답 근거, 학습 팁

## 어법/선택지 문제 분석 규칙 (매우 중요!)
- 내신 어법 문제는 항상 "어법상 틀린 것"을 고르는 문제임
- 문제에 있는 모든 선택지(1, 2, 3, 4, 5번)를 반드시 빠짐없이 분석할 것!
- is_correct: true = 정답 = 어법상 틀린 것 (수정 필요)
- is_correct: false = 오답 = 어법상 맞는 것
- 정답은 반드시 1개만 존재함
- explanation 필수 작성:
  - 오답(is_correct: false): "~이므로 어법상 올바름" 형식으로 왜 맞는지 설명
  - 정답(is_correct: true): "~이므로 어법상 틀림. X를 Y로 고쳐야 함" 형식으로 왜 틀린지 + 수정 방법 설명

## JSON 반환
{
  "question_type": "빈칸추론/어법 등",
  "difficulty": "high/medium/low",
  "sentence_comparisons": [{"original": "", "transformed": "", "change_type": "", "explanation": ""}],
  "vocabulary_changes": [{"original": "", "transformed": "", "original_context": "", "transformed_context": "", "teps_level": 850}],
  "grammar_points": [{"choice_number": 1, "content": "밑줄 친 표현", "grammatical_focus": "문법 포인트", "is_correct": false, "explanation": "상세한 문법적 근거"}],
  "transformation_summary": "",
  "teacher_intent": "",
  "answer_rationale": "",
  "study_tips": []
}

JSON만 반환하세요.`;
}

function createExternalPrompt(match: ConfirmedMatch, tepsThreshold: number): string {
  return `당신은 영어 내신 기출문제 분석 전문가입니다.

## 외부지문 문제 ${match.questionNumber}번
${match.questionText}

## 분석 요청 (반드시 위 텍스트만 기반으로)
1. 문제 유형, 난이도
2. 고난도 어휘 (TEPS ${tepsThreshold}+)
3. 문법 포인트 (어법 문제시 - 아래 중요 규칙 참고)
4. 출제 의도, 정답 근거, 학습 팁

## 어법/선택지 문제 분석 규칙 (매우 중요!)
- 내신 어법 문제는 항상 "어법상 틀린 것"을 고르는 문제임
- 문제에 있는 모든 선택지(1, 2, 3, 4, 5번)를 반드시 빠짐없이 분석할 것!
- is_correct: true = 정답 = 어법상 틀린 것 (수정 필요)
- is_correct: false = 오답 = 어법상 맞는 것
- 정답은 반드시 1개만 존재함
- explanation 필수 작성:
  - 오답(is_correct: false): "~이므로 어법상 올바름" 형식으로 왜 맞는지 설명
  - 정답(is_correct: true): "~이므로 어법상 틀림. X를 Y로 고쳐야 함" 형식으로 왜 틀린지 + 수정 방법 설명

## JSON 반환
{
  "question_type": "빈칸추론/어법 등",
  "difficulty": "high/medium/low",
  "vocabulary_changes": [{"original": "", "transformed": "-", "original_context": "", "transformed_context": "-", "teps_level": 850}],
  "grammar_points": [{"choice_number": 1, "content": "밑줄 친 표현", "grammatical_focus": "문법 포인트", "is_correct": false, "explanation": "상세한 문법적 근거"}],
  "teacher_intent": "",
  "answer_rationale": "",
  "study_tips": []
}

JSON만 반환하세요.`;
}

function parseResult(match: ConfirmedMatch, parsed: Record<string, unknown>): DetailedAnalysis {
  return {
    questionNumber: match.questionNumber,
    sourceType: match.sourceType,
    sourceName: match.sourceName,
    questionType: (parsed.question_type as string) || '기타',
    originalType: parsed.original_type as string | undefined,
    difficulty: (parsed.difficulty as 'high' | 'medium' | 'low') || 'medium',
    sentenceComparisons: ((parsed.sentence_comparisons as Array<Record<string, string>>) || []).map(s => ({
      original: s.original || '',
      transformed: s.transformed || '',
      changeType: s.change_type || '',
      explanation: s.explanation || '',
    })),
    vocabularyChanges: ((parsed.vocabulary_changes as Array<Record<string, unknown>>) || []).map(v => ({
      original: (v.original as string) || '',
      transformed: (v.transformed as string) || '',
      originalContext: (v.original_context as string) || '',
      transformedContext: (v.transformed_context as string) || '',
      tepsLevel: (v.teps_level as number) || 0,
    })),
    grammarPoints: ((parsed.grammar_points as Array<Record<string, unknown>>) || []).map(g => ({
      choiceNumber: (g.choice_number as number) || 0,
      content: (g.content as string) || '',
      grammaticalFocus: (g.grammatical_focus as string) || '',
      isCorrect: (g.is_correct as boolean) || false,
      explanation: (g.explanation as string) || '',
    })),
    transformationSummary: (parsed.transformation_summary as string) || '',
    teacherIntent: (parsed.teacher_intent as string) || '',
    answerRationale: (parsed.answer_rationale as string) || '',
    studyTips: (parsed.study_tips as string[]) || [],
  };
}

function createDefault(match: ConfirmedMatch): DetailedAnalysis {
  return {
    questionNumber: match.questionNumber,
    sourceType: match.sourceType,
    sourceName: match.sourceName,
    questionType: '기타',
    difficulty: 'medium',
    sentenceComparisons: [],
    vocabularyChanges: [],
    grammarPoints: [],
    transformationSummary: '',
    teacherIntent: '',
    answerRationale: '',
    studyTips: [],
  };
}
