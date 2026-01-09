import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

export const geminiFlash = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  safetySettings,
});

export const geminiPro = genAI.getGenerativeModel({
  model: 'gemini-2.5-pro',
  safetySettings,
});

export const geminiFlashVision = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  safetySettings,
});

export async function extractTextFromImage(imageBase64: string, mimeType: string): Promise<string> {
  const prompt = `이 이미지는 영어 시험지입니다. 2단 레이아웃으로 되어 있습니다.
왼쪽 단을 위에서 아래로 먼저 읽고, 그 다음 오른쪽 단을 위에서 아래로 읽어주세요.

문제 번호(예: 18, 19, 20...)를 기준으로 각 문제를 구분해주세요.
문장이 단을 넘어가는 경우 문맥에 맞게 연결해주세요.

추출된 텍스트만 반환해주세요. 설명이나 주석은 포함하지 마세요.`;

  const result = await geminiFlashVision.generateContent([
    prompt,
    {
      inlineData: {
        mimeType,
        data: imageBase64,
      },
    },
  ]);

  return result.response.text();
}

export async function matchQuestionToSource(
  questionText: string,
  sourceTexts: { id: string; name: string; text: string }[]
): Promise<{
  source_id: string | null;
  source_name: string;
  source_type: 'direct' | 'indirect' | 'external';
  confidence: number;
  reasoning: string;
  key_matches: string[];
  differences: string[];
}> {
  const sourcesFormatted = sourceTexts
    .map((s, i) => `[원문 ${i + 1}: ${s.name}]\n${s.text}`)
    .join('\n\n---\n\n');

  const prompt = `당신은 영어 내신 기출문제 분석 전문가입니다.

## 작업
다음 기출문제가 주어진 원문(모의고사, 교과서) 중 어디에서 나왔는지 찾아주세요.

## 기출문제
${questionText}

## 원문 후보
${sourcesFormatted}

## 판단 기준

### 직접연계 (direct)
- 단어/구절이 패러프레이징됨
- 문장 구조 70% 이상 유사
- 전체 주제/요지 동일

### 간접연계 (indirect)
- 핵심 소재만 차용
- 대부분 문장이 변형됨
- 주제는 유사하나 전개 다름

### 외부지문 (external)
- 제공된 원문 중 어디에도 없음
- 핵심 소재, 요지, 주제 모두 불일치

## 출력 형식 (JSON)
{
  "source_index": 매칭된 원문 번호 (1부터 시작, 없으면 null),
  "source_type": "direct" | "indirect" | "external",
  "confidence": 0-100 사이의 확신도,
  "reasoning": "판단 근거를 상세히 설명",
  "key_matches": ["일치하는 핵심 구문들"],
  "differences": ["주요 차이점들"]
}

## 중요
- 확신이 없으면 confidence를 낮게 설정
- 50% 미만은 선생님 검토 필요로 플래그됨
- 억지로 매칭하지 말 것
- JSON만 반환해주세요`;

  const result = await geminiPro.generateContent(prompt);
  const responseText = result.response.text();
  
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      source_id: null,
      source_name: '매칭 실패',
      source_type: 'external',
      confidence: 0,
      reasoning: '응답 파싱 실패',
      key_matches: [],
      differences: [],
    };
  }

  const parsed = JSON.parse(jsonMatch[0]);
  const sourceIndex = parsed.source_index;
  const matchedSource = sourceIndex && sourceIndex > 0 ? sourceTexts[sourceIndex - 1] : null;

  return {
    source_id: matchedSource?.id || null,
    source_name: matchedSource?.name || '외부지문',
    source_type: parsed.source_type,
    confidence: parsed.confidence,
    reasoning: parsed.reasoning,
    key_matches: parsed.key_matches || [],
    differences: parsed.differences || [],
  };
}

export async function analyzeTransformation(
  examQuestion: string,
  sourceText: string,
  sourceType: 'direct' | 'indirect'
): Promise<{
  vocabulary_changes: Array<{
    original: string;
    transformed: string;
    teps_level: number;
    change_type: string;
    is_high_difficulty: boolean;
  }>;
  structure_changes: Array<{
    description: string;
    change_type: string;
    example?: { original: string; transformed: string };
  }>;
  content_changes: Array<{
    change_type: string;
    description: string;
    is_answer_key?: boolean;
  }>;
  transformation_intent: string[];
  difficulty: 'high' | 'medium' | 'low';
}> {
  const prompt = `당신은 영어 내신 기출문제 변형 분석 전문가입니다.

## 기출문제
${examQuestion}

## 원문
${sourceText}

## 연계 유형: ${sourceType === 'direct' ? '직접연계' : '간접연계'}

## 분석 요청

### 1. 어휘 변형 (TEPS 830+ 수준만 포함)
고난도 어휘 기준:
- TEPS 830-870: 중상급 (effaced, eclipsed, eloquent 등)
- TEPS 870+: 극한난이도 (obfuscate, prevaricate, vituperate 등)
- 특별 포함: comprehend, contemplate, deteriorate, pragmatic

제외: cognitive, significant, demonstrate 등 기본 어휘

### 2. 문장 구조 변형
- 능동태/수동태 전환
- 긍정/부정 전환
- 접속사 변경
- 시제 변경
- 문장 결합/분리

### 3. 내용 변형
- 추가/삭제/수정된 내용
- 정답 근거가 되는 핵심 문장이 변형 안 된 경우 표시

### 4. 변형 의도

### 5. 전체 난이도 평가 (상/중/하)

## 출력 형식 (JSON)
{
  "vocabulary_changes": [
    {
      "original": "원본 표현",
      "transformed": "변형된 표현",
      "teps_level": TEPS 점수,
      "change_type": "synonym|paraphrase|technical|academic",
      "is_high_difficulty": true/false
    }
  ],
  "structure_changes": [
    {
      "description": "변형 설명",
      "change_type": "voice|polarity|connector|tense|sentence_combine|sentence_split|other",
      "example": { "original": "원문", "transformed": "변형" }
    }
  ],
  "content_changes": [
    {
      "change_type": "added|deleted|modified|key_sentence_unchanged",
      "description": "설명",
      "is_answer_key": true/false
    }
  ],
  "transformation_intent": ["의도1", "의도2"],
  "difficulty": "high|medium|low"
}

JSON만 반환해주세요.`;

  const result = await geminiPro.generateContent(prompt);
  const responseText = result.response.text();
  
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      vocabulary_changes: [],
      structure_changes: [],
      content_changes: [],
      transformation_intent: [],
      difficulty: 'medium',
    };
  }

  return JSON.parse(jsonMatch[0]);
}

export async function analyzeExternalPassage(
  questionText: string,
  questionType: string
): Promise<{
  translation: string;
  answer: string;
  answer_reasoning: string;
  wrong_answer_analysis: Array<{ option: string; reason: string }>;
  intent: string;
  learning_strategy: {
    required_vocabulary: Array<{ word: string; meaning: string; teps_level: number }>;
    required_grammar: string[];
    study_tips: string[];
  };
  difficulty: 'high' | 'medium' | 'low';
}> {
  const prompt = `당신은 영어 내신 기출문제 분석 전문가입니다.

## 외부지문 문제 (원문 매칭 없음)
${questionText}

## 문제 유형: ${questionType}

## 분석 요청

### 1. 지문 전문 해석

### 2. 정답 및 근거
- 정답이 무엇인지
- 왜 정답인지 상세히 설명

### 3. 오답 분석
- 각 선택지가 왜 오답인지

### 4. 출제 의도

### 5. 학습 전략
- 필요한 어휘 (TEPS 830+ 수준, 뜻과 함께)
- 필요한 문법
- 추천 학습법

### 6. 난이도 평가

## 출력 형식 (JSON)
{
  "translation": "전문 해석",
  "answer": "정답 (예: ③)",
  "answer_reasoning": "정답 근거 상세 설명",
  "wrong_answer_analysis": [
    { "option": "①", "reason": "오답인 이유" }
  ],
  "intent": "출제 의도",
  "learning_strategy": {
    "required_vocabulary": [
      { "word": "단어", "meaning": "뜻", "teps_level": 850 }
    ],
    "required_grammar": ["문법 포인트1"],
    "study_tips": ["학습법1"]
  },
  "difficulty": "high|medium|low"
}

JSON만 반환해주세요.`;

  const result = await geminiPro.generateContent(prompt);
  const responseText = result.response.text();
  
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      translation: '',
      answer: '',
      answer_reasoning: '',
      wrong_answer_analysis: [],
      intent: '',
      learning_strategy: {
        required_vocabulary: [],
        required_grammar: [],
        study_tips: [],
      },
      difficulty: 'medium',
    };
  }

  return JSON.parse(jsonMatch[0]);
}

export interface VocabDetail {
  word: string;
  meaning: string;
  pronunciation: string;
  etymology: string;
}

export async function generateVocabDetails(words: string[]): Promise<VocabDetail[]> {
  if (words.length === 0) return [];

  const prompt = `영어 단어 및 숙어 목록에 대해 한국어로 뜻, IPA 발음기호, 간단한 어원/어근 설명을 제공해주세요.

## 단어/숙어 목록
${words.join(', ')}

## 출력 형식 (JSON 배열)
[
  {
    "word": "implicit",
    "meaning": "암묵적인, 함축된",
    "pronunciation": "/ɪmˈplɪsɪt/",
    "etymology": "im-(안에) + plic(접다) → 안에 접혀있는"
  },
  {
    "word": "at a cost of",
    "meaning": "~의 대가로, ~을 희생하고",
    "pronunciation": "",
    "etymology": "cost(대가) + of → ~의 대가로"
  }
]

## 규칙
1. meaning: 핵심 뜻 1-2개만 (한국어)
2. pronunciation: 단어는 IPA 발음기호, 숙어는 빈 문자열
3. etymology: 
   - 단어: 접두사/어근/접미사 분해 + 의미 연결 (20자 이내)
   - 숙어: 핵심 단어 의미 기반 설명 (20자 이내)
   - 어원이 불분명하면 빈 문자열

JSON 배열만 반환해주세요.`;

  try {
    const result = await geminiFlash.generateContent(prompt);
    const responseText = result.response.text();
    
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[Gemini] Vocab details generation error:', error);
    return [];
  }
}

export async function generateSummaryReport(
  questions: Array<{
    question_number: number;
    source_type: string;
    source_name: string;
    difficulty: string;
    vocabulary_changes?: Array<{ word: string; teps_level: number }>;
    question_type: string;
    original_question_type?: string;
  }>
): Promise<{
  overall_difficulty: 'high' | 'medium' | 'low';
  difficulty_analysis: {
    increased: number;
    same: number;
    decreased: number;
    main_factors: string[];
  };
  learning_strategies: Array<{
    priority: number;
    title: string;
    description: string;
    details: string[];
  }>;
  key_patterns: Array<{
    pattern: string;
    count: number;
    description: string;
  }>;
}> {
  const prompt = `당신은 영어 내신 기출문제 분석 전문가입니다.

## 분석된 문제 데이터
${JSON.stringify(questions, null, 2)}

## 요청
위 데이터를 바탕으로 통합 보고서를 생성해주세요.

### 1. 전체 난이도 평가

### 2. 난이도 변화 분석
- 원본 대비 상승/유지/하락 문항 수
- 주요 난이도 상승 요인

### 3. 학습 전략 (우선순위별로 3-5개)
- 각 전략의 제목, 설명, 상세 내용

### 4. 핵심 변형 패턴 (빈도 높은 순으로 5개)

## 출력 형식 (JSON)
{
  "overall_difficulty": "high|medium|low",
  "difficulty_analysis": {
    "increased": 숫자,
    "same": 숫자,
    "decreased": 숫자,
    "main_factors": ["요인1", "요인2"]
  },
  "learning_strategies": [
    {
      "priority": 1,
      "title": "전략 제목",
      "description": "설명",
      "details": ["상세1", "상세2"]
    }
  ],
  "key_patterns": [
    {
      "pattern": "패턴명",
      "count": 횟수,
      "description": "설명"
    }
  ]
}

JSON만 반환해주세요.`;

  const result = await geminiPro.generateContent(prompt);
  const responseText = result.response.text();
  
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      overall_difficulty: 'medium',
      difficulty_analysis: { increased: 0, same: 0, decreased: 0, main_factors: [] },
      learning_strategies: [],
      key_patterns: [],
    };
  }

  return JSON.parse(jsonMatch[0]);
}
