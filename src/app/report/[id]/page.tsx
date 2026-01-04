'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import {
  FileText,
  Lock,
  BarChart3,
  BookOpen,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
} from 'lucide-react';
import { QUESTION_TYPE_LABELS, QuestionType } from '@/types';

interface MockQuestion {
  number: number;
  sourceType: 'direct' | 'indirect' | 'external';
  sourceName: string;
  confidence: number;
  questionType: QuestionType;
  originalType?: QuestionType;
  difficulty: 'high' | 'medium' | 'low';
  vocabularyChanges: { original: string; transformed: string; tepsLevel: number }[];
}

const mockQuestions: MockQuestion[] = [
  {
    number: 1,
    sourceType: 'direct',
    sourceName: '2024년 3월 모의고사 18번',
    confidence: 95,
    questionType: 'purpose',
    difficulty: 'medium',
    vocabularyChanges: [
      { original: 'demolish', transformed: 'tear down', tepsLevel: 780 },
    ],
  },
  {
    number: 2,
    sourceType: 'indirect',
    sourceName: '2024년 3월 모의고사 22번',
    confidence: 72,
    questionType: 'blank',
    originalType: 'gist',
    difficulty: 'high',
    vocabularyChanges: [
      { original: 'persistent', transformed: 'relentless', tepsLevel: 850 },
      { original: 'deteriorate', transformed: 'decline', tepsLevel: 830 },
    ],
  },
  {
    number: 3,
    sourceType: 'external',
    sourceName: '외부지문',
    confidence: 0,
    questionType: 'blank',
    difficulty: 'high',
    vocabularyChanges: [
      { original: 'eclipse', transformed: '-', tepsLevel: 870 },
      { original: 'obfuscate', transformed: '-', tepsLevel: 880 },
    ],
  },
];

export default function ReportPage() {
  const params = useParams();
  const reportId = params.id as string;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'questions' | 'vocabulary'>('summary');
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'test123') {
      setIsAuthenticated(true);
      setPasswordError('');
    } else {
      setPasswordError('비밀번호가 올바르지 않습니다.');
    }
  };

  const toggleQuestion = (num: number) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        next.add(num);
      }
      return next;
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border shadow-lg max-w-md w-full p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">리포트 접근</h1>
            <p className="text-slate-500 mt-2">
              백영고등학교 2024학년도 1학기 중간고사
              <br />
              영어 기출문제 분석 리포트
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">비밀번호</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              {passwordError && <p className="text-red-500 text-sm mt-2">{passwordError}</p>}
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              확인
            </button>
          </form>

          <p className="text-center text-sm text-slate-400 mt-6">
            테스트 비밀번호: test123
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-7 h-7 text-blue-600" />
            <div>
              <h1 className="font-bold text-slate-900">백영고등학교</h1>
              <p className="text-sm text-slate-500">2024학년도 1학기 중간고사 영어</p>
            </div>
          </div>
          <div className="flex items-center gap-3 no-print">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <Download className="w-4 h-4" />
              PDF 다운로드
            </button>
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                isEditMode ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Edit3 className="w-4 h-4" />
              {isEditMode ? '편집 중' : '편집 모드'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex gap-2 mb-6">
          {(['summary', 'questions', 'vocabulary'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab === 'summary' && '통합 보고서'}
              {tab === 'questions' && '문항별 분석'}
              {tab === 'vocabulary' && '어휘 총정리'}
            </button>
          ))}
        </div>

        {activeTab === 'summary' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <StatCard
                icon={<BarChart3 className="w-5 h-5 text-blue-600" />}
                label="총 문항"
                value="30"
                subtext="문항"
              />
              <StatCard
                icon={<CheckCircle2 className="w-5 h-5 text-green-600" />}
                label="직접연계"
                value="20"
                subtext="66.7%"
                color="green"
              />
              <StatCard
                icon={<TrendingUp className="w-5 h-5 text-yellow-600" />}
                label="간접연계"
                value="6"
                subtext="20%"
                color="yellow"
              />
              <StatCard
                icon={<BookOpen className="w-5 h-5 text-purple-600" />}
                label="외부지문"
                value="4"
                subtext="13.3%"
                color="purple"
              />
            </div>

            <div className="bg-white rounded-2xl border p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                난이도 총평
              </h2>
              <div className="flex items-center gap-4 mb-4">
                <span className="px-4 py-2 bg-orange-100 text-orange-700 rounded-full font-semibold">
                  중상
                </span>
                <p className="text-slate-600">원본 대비 전체적으로 난이도가 상승했습니다.</p>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-red-50 rounded-lg p-4">
                  <p className="text-sm text-red-600 mb-1">난이도 상승</p>
                  <p className="text-2xl font-bold text-red-700">18문항 (60%)</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-600 mb-1">난이도 유지</p>
                  <p className="text-2xl font-bold text-slate-700">8문항 (26.7%)</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-600 mb-1">난이도 하락</p>
                  <p className="text-2xl font-bold text-green-700">4문항 (13.3%)</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-green-600" />
                필요한 학습 전략
              </h2>
              <div className="space-y-4">
                <LearningStrategy
                  priority={1}
                  title="고난도 어휘 암기 (최우선!)"
                  description="TEPS 830+ 어휘 62개가 출제되었습니다."
                  details={[
                    'eclipse, deteriorate, pragmatic 등 필수 암기',
                    '패러프레이징 표현 127개 패턴 학습',
                  ]}
                />
                <LearningStrategy
                  priority={2}
                  title="꼼꼼한 문법 공부"
                  description="어법 문제 6문항 중 5문항이 고난도입니다."
                  details={['분사구문, 관계대명사 집중 학습', '능동태/수동태 전환 연습']}
                />
                <LearningStrategy
                  priority={3}
                  title="문제 유형 전환 대비"
                  description="같은 지문이 다른 유형으로 출제되는 패턴 8건 확인되었습니다."
                  details={['빈칸→순서 전환 연습', '요지→빈칸 전환 연습']}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="space-y-4">
            {mockQuestions.map((q) => (
              <QuestionCard
                key={q.number}
                question={q}
                isExpanded={expandedQuestions.has(q.number)}
                onToggle={() => toggleQuestion(q.number)}
                isEditMode={isEditMode}
              />
            ))}
          </div>
        )}

        {activeTab === 'vocabulary' && (
          <div className="bg-white rounded-2xl border p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              고난도 어휘 목록 (TEPS 830+)
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium text-slate-600">어휘</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">의미</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">TEPS 레벨</th>
                    <th className="text-left py-3 px-4 font-medium text-slate-600">출현 횟수</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { word: 'eclipse', meaning: '빛을 가리다, 무색하게 하다', level: 870, count: 3 },
                    { word: 'deteriorate', meaning: '악화되다', level: 830, count: 2 },
                    { word: 'obfuscate', meaning: '혼란스럽게 하다', level: 880, count: 1 },
                    { word: 'pragmatic', meaning: '실용적인', level: 830, count: 2 },
                    { word: 'meticulous', meaning: '꼼꼼한', level: 830, count: 1 },
                  ].map((v, i) => (
                    <tr key={i} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4 font-medium text-slate-900">{v.word}</td>
                      <td className="py-3 px-4 text-slate-600">{v.meaning}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded text-sm font-medium ${
                            v.level >= 870
                              ? 'bg-red-100 text-red-700'
                              : v.level >= 850
                              ? 'bg-orange-100 text-orange-700'
                              : 'bg-yellow-100 text-yellow-700'
                          }`}
                        >
                          {v.level}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">{v.count}회</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  color = 'blue',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-slate-900">{value}</span>
        <span className="text-sm text-slate-500">{subtext}</span>
      </div>
    </div>
  );
}

function LearningStrategy({
  priority,
  title,
  description,
  details,
}: {
  priority: number;
  title: string;
  description: string;
  details: string[];
}) {
  return (
    <div className="bg-slate-50 rounded-xl p-5">
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold flex-shrink-0">
          {priority}
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600 mt-1">{description}</p>
          <ul className="mt-2 space-y-1">
            {details.map((d, i) => (
              <li key={i} className="text-sm text-slate-500 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                {d}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  isExpanded,
  onToggle,
  isEditMode,
}: {
  question: MockQuestion;
  isExpanded: boolean;
  onToggle: () => void;
  isEditMode: boolean;
}) {
  const sourceTypeColors = {
    direct: 'bg-green-100 text-green-700',
    indirect: 'bg-yellow-100 text-yellow-700',
    external: 'bg-purple-100 text-purple-700',
  };

  const sourceTypeLabels = {
    direct: '직접연계',
    indirect: '간접연계',
    external: '외부지문',
  };

  const difficultyColors = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-orange-100 text-orange-700',
    low: 'bg-green-100 text-green-700',
  };

  const difficultyLabels = {
    high: '상',
    medium: '중',
    low: '하',
  };

  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-4">
          <span className="text-lg font-bold text-slate-900">문제 {question.number}번</span>
          <span className={`px-2 py-1 rounded text-sm font-medium ${sourceTypeColors[question.sourceType]}`}>
            {sourceTypeLabels[question.sourceType]}
          </span>
          {question.confidence > 0 && question.confidence < 50 && (
            <span className="flex items-center gap-1 text-amber-600 text-sm">
              <AlertTriangle className="w-4 h-4" />
              검토 필요
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className={`px-2 py-1 rounded text-sm font-medium ${difficultyColors[question.difficulty]}`}>
            난이도: {difficultyLabels[question.difficulty]}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 border-t bg-slate-50">
          <div className="py-4 space-y-4">
            <div>
              <p className="text-sm text-slate-500 mb-1">원문 출처</p>
              <p className="font-medium text-slate-900">{question.sourceName}</p>
              {question.confidence > 0 && (
                <p className="text-sm text-slate-500 mt-1">확신도: {question.confidence}%</p>
              )}
            </div>

            <div>
              <p className="text-sm text-slate-500 mb-1">문제 유형</p>
              <p className="font-medium text-slate-900">
                {QUESTION_TYPE_LABELS[question.questionType]}
                {question.originalType && question.originalType !== question.questionType && (
                  <span className="text-orange-600 ml-2">
                    (원본: {QUESTION_TYPE_LABELS[question.originalType]} → 변형)
                  </span>
                )}
              </p>
            </div>

            {question.vocabularyChanges.length > 0 && (
              <div>
                <p className="text-sm text-slate-500 mb-2">어휘 변형 (TEPS 830+)</p>
                <div className="space-y-2">
                  {question.vocabularyChanges.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="font-medium text-slate-900">{v.original}</span>
                      <span className="text-slate-400">→</span>
                      <span className="text-slate-700">{v.transformed}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          v.tepsLevel >= 870
                            ? 'bg-red-100 text-red-700'
                            : v.tepsLevel >= 850
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}
                      >
                        {v.tepsLevel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isEditMode && (
              <div className="pt-4 border-t">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  선생님 코멘트
                </label>
                <textarea
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                  rows={3}
                  placeholder="이 문제에 대한 추가 설명을 입력하세요..."
                />
                <div className="flex justify-end mt-2">
                  <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                    저장
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
