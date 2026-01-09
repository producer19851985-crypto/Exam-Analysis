import { geminiPro } from './gemini';
import { MetaInsights, MetaInsightsInput, VocabLevel } from '@/types/analyzer';
import { cefrToVocabLevel } from '@/constants/vocabulary';

function extractJsonFromResponse(text: string): string | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[0] : null;
}

export async function generateMetaInsights(input: MetaInsightsInput): Promise<MetaInsights> {
  const { schoolName, examName, grade, totalQuestions, questions, overviewData } = input;

  const typeBreakdown = overviewData.typeDistribution
    .slice(0, 5)
    .map((t) => `- ${t.label}: ${t.count}개 (${t.percentage}%)`)
    .join('\n');

  const difficultyBreakdown = {
    high: questions.filter((q) => q.difficulty === 'high').length,
    medium: questions.filter((q) => q.difficulty === 'medium').length,
    low: questions.filter((q) => q.difficulty === 'low').length,
  };

  const prompt = `당신은 영어 내신 시험 분석 전문가입니다.

## 시험 정보
- 학교: ${schoolName}
- 시험명: ${examName}
- 학년: ${grade}
- 총 문항 수: ${totalQuestions}개

## 난이도 분포
- 상: ${difficultyBreakdown.high}개
- 중: ${difficultyBreakdown.medium}개
- 하: ${difficultyBreakdown.low}개

## 문제 유형 분포
${typeBreakdown}

## 분석 요청 (해설 데이터 기반)

### 1. 빈출 고난도 어휘 TOP 10
- 이 시험에서 꼭 알아야 할 고난도 어휘
- 각 어휘의 뜻, 난이도 레벨(basic/hard/very_hard/extreme), 예문
- C1(very_hard) 이상 수준 어휘 위주로

### 2. 문제 유형별 핵심 전략 (3-5개)
- 빈칸추론, 어법, 어휘 등 각 유형별 접근법
- 각 전략의 중요도(high/medium/low)
- 실전 팁 포함

### 3. 오답 함정 패턴 (3-5개)
- 학생들이 자주 틀리는 유형
- 어떻게 피할 수 있는지 팁

### 4. 맞춤 학습 로드맵 (3-4단계)
- 이 시험을 준비하기 위한 단계별 학습 계획
- 각 단계의 소요 기간, 할 일, 집중 영역

### 5. 전체 코멘트
- 2-3문장으로 이 시험의 특징과 대비 전략 요약

## 출력 형식 (JSON)
{
  "topVocabulary": [
    {
      "rank": 1,
      "word": "어휘",
      "meaning": "뜻",
      "level": "basic|hard|very_hard|extreme",
      "occurrences": 1,
      "exampleSentence": "예문"
    }
  ],
  "vocabStrategies": [
    {
      "strategy": "유형명 (예: 빈칸추론)",
      "description": "핵심 접근법",
      "examples": [{"original": "문제 특징", "transformed": "해결 전략"}],
      "frequency": "high|medium|low"
    }
  ],
  "trapPatterns": [
    {
      "pattern": "패턴명",
      "description": "설명",
      "affectedQuestions": [1, 2, 3],
      "avoidanceTip": "회피 팁"
    }
  ],
  "learningRoadmap": [
    {
      "phase": 1,
      "title": "단계 제목",
      "duration": "소요 기간",
      "tasks": ["할 일들"],
      "focusAreas": ["집중 영역들"]
    }
  ],
  "overallComment": "전체 코멘트"
}

JSON만 반환하세요.`;

  try {
    const result = await geminiPro.generateContent(prompt);
    const responseText = result.response.text();

    const jsonStr = extractJsonFromResponse(responseText);
    if (!jsonStr) {
      throw new Error('JSON 파싱 실패');
    }

    const parsed = JSON.parse(jsonStr) as MetaInsights;

    parsed.topVocabulary = parsed.topVocabulary.map((v) => ({
      ...v,
      level: cefrToVocabLevel(
        v.level === 'basic' ? 2 :
        v.level === 'hard' ? 4 :
        v.level === 'very_hard' ? 5 : 6
      ),
    }));

    return parsed;
  } catch (error) {
    console.error('[MetaAnalyzer] Error:', error);
    return getDefaultMetaInsights();
  }
}

function getDefaultMetaInsights(): MetaInsights {
  return {
    topVocabulary: [],
    vocabStrategies: [],
    trapPatterns: [],
    learningRoadmap: [
      {
        phase: 1,
        title: '기본 어휘 복습',
        duration: '1주',
        tasks: ['교과서 어휘 암기', '기출 어휘 정리'],
        focusAreas: ['핵심 어휘'],
      },
    ],
    overallComment: '메타 인사이트 생성에 실패했습니다. 다시 시도해주세요.',
  };
}
