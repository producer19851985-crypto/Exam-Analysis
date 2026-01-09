'use client';

import { useState, useEffect } from 'react';
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
  Loader2,
  Copy,
  Share2,
  Printer,
  Plus,
  Trash2,
  Save,
  List,
  Home,
} from 'lucide-react';
import Link from 'next/link';
import { formatSourceName } from '@/lib/utils';
import { QUESTION_TYPE_LABELS, QuestionType } from '@/types';
import { OverviewTab } from '@/components/report/OverviewTab';
import { OverviewData } from '@/types/analyzer';

const renderTextWithUnderline = (text: string) => {
  const processed = text
    .replace(/<u>/g, '**')
    .replace(/<\/u>/g, '**');
  
  const parts = processed.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      const content = part.slice(2, -2);
      return <u key={index} className="underline decoration-2">{content}</u>;
    }
    return <span key={index}>{part}</span>;
  });
};

interface SentenceComparison {
  originalSentence: string;
  transformedSentence: string;
  changeType: string;
  explanation: string;
}

interface VocabularyChange {
  original: string;
  transformed: string;
  originalContext: string;
  transformedContext: string;
  tepsLevel: number;
}

interface GrammarChoice {
  choiceNumber: number;
  content: string;
  grammaticalFocus: string;
  isCorrect: boolean;
  explanation: string;
}

interface WrongAnswerAnalysis {
  choice: string;
  reason: string;
}

interface AnalysisQuestion {
  questionNumber: number;
  questionText?: string;
  sourceText?: string;
  sourceType: 'direct' | 'indirect' | 'external';
  sourceName: string;
  sourceNumber?: number | null;
  confidence: number;
  questionType: string;
  originalType?: string;
  difficulty: 'high' | 'medium' | 'low';
  
  sentenceComparisons?: SentenceComparison[];
  vocabularyChanges: VocabularyChange[];
  grammarChoices?: GrammarChoice[];
  wrongAnswerAnalysis?: WrongAnswerAnalysis[];
  
  transformationSummary?: string;
  teacherIntent?: string;
  answerRationale?: string;
  studyRecommendations?: string[];
  
  structureChanges?: string[];
  transformationIntent?: string[];
  translation?: string;
  answerAnalysis?: string;
}

interface AnalysisResult {
  questions: AnalysisQuestion[];
  summary: {
    total: number;
    direct: number;
    indirect: number;
    external: number;
    overallDifficulty: string;
  };
}

interface ReportMetadata {
  school_name: string;
  grade: string;
  exam_name: string;
  student_password: string;
  edit_password: string;
  vocabulary_level: string;
  created_at: string;
}

export default function ReportPage() {
  const params = useParams();
  const reportId = params.id as string;
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [isStudentPrintMode, setIsStudentPrintMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'questions' | 'vocabulary' | 'compare'>('summary');
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [reportMetadata, setReportMetadata] = useState<ReportMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [teacherComments, setTeacherComments] = useState<Record<number, string>>({});
  const [isPublished, setIsPublished] = useState<boolean | null>(null);
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await fetch(`/api/report/${reportId}`);
        const result = await response.json();

        if (result.success) {
          const { metadata, questions, summary, overview_data } = result.data;

          if (metadata.status === 'published') {
            setIsPublished(true);
          } else {
            setIsPublished(false);
          }

          setReportMetadata(metadata);
          setAnalysisResult({ questions, summary });
          if (overview_data) {
            setOverviewData(overview_data);
          }
          
          const comments: Record<number, string> = {};
          questions.forEach((q: any) => {
            if (q.teacherComment) {
              comments[q.questionNumber] = q.teacherComment;
            }
          });
          setTeacherComments(comments);
        } else {
          setIsPublished(false);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        setIsPublished(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [reportId]);

  const saveComment = async (questionNumber: number, comment: string) => {
    const newComments = { ...teacherComments, [questionNumber]: comment };
    setTeacherComments(newComments);
    
    await fetch(`/api/report/${reportId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_comment',
        questionNumber,
        comment,
      }),
    });
  };

  const recalculateSummary = (questions: AnalysisQuestion[]) => {
    const direct = questions.filter((q) => q.sourceType === 'direct').length;
    const indirect = questions.filter((q) => q.sourceType === 'indirect').length;
    const external = questions.filter((q) => q.sourceType === 'external').length;
    const highDifficulty = questions.filter((r) => r.difficulty === 'high').length;

    return {
      total: questions.length,
      direct,
      indirect,
      external,
      overallDifficulty: highDifficulty > questions.length / 2 ? 'high' : 'medium',
    };
  };

  const updateQuestion = async (questionNumber: number, updates: Partial<AnalysisQuestion>) => {
    if (!analysisResult) return;

    const updatedQuestions = analysisResult.questions.map((q) => {
      if (q.questionNumber === questionNumber) {
        return { ...q, ...updates };
      }
      return q;
    });

    const newResult = {
      ...analysisResult,
      questions: updatedQuestions,
      summary: recalculateSummary(updatedQuestions),
    };

    setAnalysisResult(newResult);

    await fetch(`/api/report/${reportId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_question',
        questionNumber,
        updates,
      }),
    });
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportMetadata) {
      setPasswordError('리포트 데이터를 찾을 수 없습니다.');
      return;
    }
    
    if (password === reportMetadata.student_password || password === reportMetadata.edit_password) {
      setIsAuthenticated(true);
      setIsEditMode(password === reportMetadata.edit_password);
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

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(label);
      setTimeout(() => setCopySuccess(null), 2000);
    } catch {
      console.error('Copy failed');
    }
  };

  const copyShareInfo = () => {
    if (!reportMetadata) return;
    const url = window.location.href;
    const text = `${reportMetadata.school_name} ${reportMetadata.exam_name} 분석 리포트\n\n링크: ${url}\n비밀번호: ${reportMetadata.student_password}`;
    copyToClipboard(text, 'share');
  };

  const copyVocabularyList = () => {
    if (!analysisResult) return;
    const vocab = analysisResult.questions
      .flatMap(q => q.vocabularyChanges)
      .filter(v => v.tepsLevel >= 830)
      .map(v => `${v.original} → ${v.transformed} (TEPS ${v.tepsLevel})`)
      .join('\n');
    copyToClipboard(vocab, 'vocab');
  };

  const exportToCSV = () => {
    if (!analysisResult) return;
    const vocab = analysisResult.questions
      .flatMap(q => q.vocabularyChanges)
      .filter(v => v.tepsLevel >= 830);
    
    const csv = [
      '원문어휘,변형어휘,TEPS레벨,원문문맥,변형문맥',
      ...vocab.map(v => 
        `"${v.original}","${v.transformed}",${v.tepsLevel},"${v.originalContext || ''}","${v.transformedContext || ''}"`
      )
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `어휘목록_${reportMetadata?.school_name || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStudentPrint = () => {
    // 인쇄 시 모든 문항 펼치기
    if (analysisResult) {
      const allQuestionNumbers = new Set(analysisResult.questions.map(q => q.questionNumber));
      setExpandedQuestions(allQuestionNumbers);
    }
    setIsStudentPrintMode(true);
    setTimeout(() => {
      window.print();
      setIsStudentPrintMode(false);
    }, 100);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-300">리포트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (isPublished === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700 shadow-2xl max-w-md w-full p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">아직 게시되지 않았습니다</h1>
          <p className="text-slate-400">선생님이 분석 결과를 검토 중입니다. 잠시 후 다시 확인해주세요.</p>
        </div>
      </div>
    );
  }

  if (!analysisResult || !reportMetadata) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700 shadow-2xl max-w-md w-full p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">리포트를 찾을 수 없습니다</h1>
          <p className="text-slate-400">분석이 완료되지 않았거나 잘못된 링크입니다.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl border border-slate-700 shadow-2xl max-w-md w-full p-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-500/25">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">리포트 접근</h1>
            <p className="text-slate-400 mt-2">
              {reportMetadata.school_name} {reportMetadata.exam_name}
            </p>
          </div>

          <form onSubmit={handlePasswordSubmit}>
            <div className="mb-6">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
                className="w-full px-5 py-4 bg-slate-900/50 border border-slate-600 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none text-white placeholder-slate-500"
              />
              {passwordError && <p className="text-red-400 text-sm mt-2">{passwordError}</p>}
            </div>
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-yellow-300 to-yellow-400 text-white py-4 rounded-xl font-semibold hover:from-pink-400 hover:to-rose-500 transition-all shadow-lg shadow-yellow-500/25"
            >
              확인
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { questions, summary } = analysisResult;
  const directPercent = summary.total > 0 ? ((summary.direct / summary.total) * 100).toFixed(1) : '0';
  const indirectPercent = summary.total > 0 ? ((summary.indirect / summary.total) * 100).toFixed(1) : '0';
  const externalPercent = summary.total > 0 ? ((summary.external / summary.total) * 100).toFixed(1) : '0';
  
  const allVocabulary = questions
    .flatMap(q => q.vocabularyChanges.map(v => ({ ...v, questionNumber: q.questionNumber })))
    .filter(v => v.tepsLevel >= 830)
    .reduce((acc, v) => {
      const existing = acc.find(item => item.original === v.original);
      if (existing) {
        existing.count++;
        if (!existing.questionNumbers.includes(v.questionNumber)) {
          existing.questionNumbers.push(v.questionNumber);
        }
      } else {
        acc.push({ ...v, count: 1, questionNumbers: [v.questionNumber] });
      }
      return acc;
    }, [] as Array<VocabularyChange & { count: number; questionNumbers: number[] }>)
    .sort((a, b) => b.tepsLevel - a.tepsLevel);

  const highDifficultyCount = questions.filter(q => q.difficulty === 'high').length;
  const mediumDifficultyCount = questions.filter(q => q.difficulty === 'medium').length;
  const lowDifficultyCount = questions.filter(q => q.difficulty === 'low').length;

  return (
    <div className={`min-h-screen ${isStudentPrintMode ? 'bg-white' : 'bg-gradient-to-br from-slate-50 to-slate-100'}`}>
      <header className={`border-b sticky top-0 z-50 ${isStudentPrintMode ? 'bg-white' : 'bg-white/80 backdrop-blur-xl'}`}>
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900">{reportMetadata.school_name}</h1>
              <p className="text-sm text-slate-500">{reportMetadata.exam_name}</p>
            </div>
          </div>
          
          {(!isAuthenticated || isEditMode) && (
            <div className="flex items-center gap-2 no-print">
              {copySuccess && (
                <span className="text-green-600 text-sm flex items-center gap-1 px-3 py-1 bg-green-50 rounded-lg">
                  <CheckCircle2 className="w-4 h-4" />
                  복사됨
                </span>
              )}

              <Link
                href="/saved"
                className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="저장된 분석 목록"
              >
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">목록</span>
              </Link>

              <Link
                href="/upload"
                className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="새 분석 시작"
              >
                <Home className="w-4 h-4" />
                <span className="hidden sm:inline">홈</span>
              </Link>

              <button
                onClick={copyShareInfo}
                className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="학생 공유용 링크+비번 복사"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">공유</span>
              </button>

              <button
                onClick={handleStudentPrint}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white hover:bg-slate-700 rounded-lg transition-colors"
                title="인쇄하기"
              >
                <Printer className="w-4 h-4" />
                <span className="hidden sm:inline">인쇄</span>
              </button>

              <button
                onClick={() => {
                  if (analysisResult) {
                    const allQuestionNumbers = new Set(analysisResult.questions.map(q => q.questionNumber));
                    setExpandedQuestions(allQuestionNumbers);
                  }
                  setTimeout(() => window.print(), 100);
                }}
                className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>

              {isEditMode && (
                <div className="flex items-center gap-1 px-3 py-2 rounded-lg bg-yellow-500 text-white">
                  <Edit3 className="w-4 h-4" />
                  <span className="hidden sm:inline">편집 모드</span>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          {(['summary', 'compare', 'vocabulary', 'questions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 rounded-xl font-medium transition-all ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-yellow-300 to-yellow-400 text-white shadow-lg shadow-yellow-500/25'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {tab === 'summary' && '통합 보고서'}
              {tab === 'compare' && '원문 매칭'}
              {tab === 'vocabulary' && '어휘 총정리'}
              {tab === 'questions' && '문항별 분석'}
            </button>
          ))}
        </div>

        {activeTab === 'summary' && (
          <div className="space-y-6">
            <div className="grid md:grid-cols-4 gap-4">
              <StatCard label="총 문항" value={String(summary.total)} subtext="문항" color="blue" />
              <StatCard label="직접연계" value={String(summary.direct)} subtext={`${directPercent}%`} color="green" />
              <StatCard label="간접연계" value={String(summary.indirect)} subtext={`${indirectPercent}%`} color="amber" />
              <StatCard label="외부지문" value={String(summary.external)} subtext={`${externalPercent}%`} color="purple" />
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-yellow-600" />
                난이도 분포
              </h2>
              <div className="grid md:grid-cols-3 gap-4">
                <DifficultyCard label="고난도" count={highDifficultyCount} total={summary.total} color="red" />
                <DifficultyCard label="중난도" count={mediumDifficultyCount} total={summary.total} color="amber" />
                <DifficultyCard label="저난도" count={lowDifficultyCount} total={summary.total} color="green" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-green-600" />
                학습 전략
              </h2>
              <div className="space-y-3">
                {allVocabulary.length > 0 && (
                  <StrategyItem
                    priority={1}
                    title={`고난도 어휘 ${allVocabulary.length}개 암기`}
                    description={allVocabulary.slice(0, 3).map(v => v.original).join(', ') + ' 등'}
                  />
                )}
                {highDifficultyCount > 0 && (
                  <StrategyItem
                    priority={2}
                    title={`고난도 문제 ${highDifficultyCount}문항 집중 대비`}
                    description="지문 구조 분석, 유형별 접근법 학습"
                  />
                )}
                {summary.external > 0 && (
                  <StrategyItem
                    priority={3}
                    title={`외부지문 ${summary.external}개 대비`}
                    description="다양한 주제 독해, 추론 연습"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'questions' && (
          <div className="space-y-4">
            {questions.map((q) => (
              <QuestionCard
                key={q.questionNumber}
                question={q}
                isExpanded={expandedQuestions.has(q.questionNumber)}
                onToggle={() => toggleQuestion(q.questionNumber)}
                isEditMode={isEditMode}
                isStudentPrintMode={isStudentPrintMode}
                comment={teacherComments[q.questionNumber] || ''}
                onSaveComment={(comment) => saveComment(q.questionNumber, comment)}
                onUpdateQuestion={(updates) => updateQuestion(q.questionNumber, updates)}
              />
            ))}
          </div>
        )}

        {activeTab === 'vocabulary' && (
          <div className="space-y-4">
            {overviewData ? (
              <OverviewTab data={overviewData} />
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
                <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">어휘 분석 데이터가 없습니다.</p>
                <p className="text-sm text-slate-400 mt-2">
                  analyzer 도구에서 분석을 먼저 진행해주세요.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'compare' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-2">원문 vs 기출 비교</h2>
              <p className="text-sm text-slate-500 mb-6">
                각 문항의 원문(모의고사/교과서)과 기출문제를 나란히 비교합니다. 외부지문은 원문이 없습니다.
              </p>
            </div>
            
            {questions.map((q) => (
              <div key={q.questionNumber} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-slate-900">#{q.questionNumber}</span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                      q.sourceType === 'direct' ? 'bg-green-100 text-green-700 border-green-200' :
                      q.sourceType === 'indirect' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                      'bg-purple-100 text-purple-700 border-purple-200'
                    }`}>
                      {q.sourceType === 'direct' ? '직접연계' : q.sourceType === 'indirect' ? '간접연계' : '외부지문'}
                    </span>
                    <span className="text-sm text-slate-500">{formatSourceName(q.sourceName, q.sourceNumber)}</span>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                        <BookOpen className="w-4 h-4 text-blue-600" />
                      </div>
                      <h3 className="font-semibold text-slate-900">원문</h3>
                    </div>
                    {q.sourceType === 'external' ? (
                      <div className="p-4 bg-slate-50 rounded-xl text-center">
                        <p className="text-slate-400">외부지문 - 원문 없음</p>
                      </div>
                    ) : q.sourceText ? (
                      <div className="p-4 bg-blue-50 rounded-xl">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {q.sourceText}
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-xl text-center">
                        <p className="text-slate-400">원문 텍스트가 없습니다</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-yellow-600" />
                      </div>
                      <h3 className="font-semibold text-slate-900">기출문제</h3>
                    </div>
                    {q.questionText ? (
                      <div className="p-4 bg-yellow-50 rounded-xl">
                        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                          {renderTextWithUnderline(q.questionText)}
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-xl text-center">
                        <p className="text-slate-400">기출문제 텍스트가 없습니다</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, subtext, color }: { label: string; value: string; subtext: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'from-pink-400 to-pink-500',
    green: 'from-green-500 to-green-600',
    amber: 'from-amber-500 to-amber-600',
    purple: 'from-purple-500 to-purple-600',
  };
  
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold bg-gradient-to-r ${colors[color]} bg-clip-text text-transparent`}>{value}</span>
        <span className="text-sm text-slate-400">{subtext}</span>
      </div>
    </div>
  );
}

function DifficultyCard({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percent = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
  const colors: Record<string, string> = {
    red: 'bg-red-50 border-red-100 text-red-700',
    amber: 'bg-amber-50 border-amber-100 text-amber-700',
    green: 'bg-green-50 border-green-100 text-green-700',
  };
  
  return (
    <div className={`rounded-xl p-4 border ${colors[color]}`}>
      <p className="text-sm opacity-80 mb-1">{label}</p>
      <p className="text-2xl font-bold">{count}문항 <span className="text-base font-normal opacity-60">({percent}%)</span></p>
    </div>
  );
}

function StrategyItem({ priority, title, description }: { priority: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4 p-4 bg-slate-50 rounded-xl">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-400 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
        {priority}
      </div>
      <div>
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function VocabCard({ vocab }: { vocab: VocabularyChange & { count: number; questionNumbers?: number[] } }) {
  const levelColor = vocab.tepsLevel >= 870 ? 'bg-red-100 text-red-700' : vocab.tepsLevel >= 850 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700';

  return (
    <div className="border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-slate-900">{vocab.original}</span>
          {vocab.transformed && vocab.transformed !== '-' && (
            <>
              <span className="text-slate-300">→</span>
              <span className="text-lg font-semibold text-purple-600">{vocab.transformed}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${levelColor}`}>
            TEPS {vocab.tepsLevel}
          </span>
          {vocab.questionNumbers && vocab.questionNumbers.length > 0 && (
            <span className="px-2 py-1 rounded-lg text-xs bg-blue-100 text-blue-700">
              {vocab.questionNumbers.map(n => `#${n}`).join(', ')}
            </span>
          )}
        </div>
      </div>
      {(vocab.originalContext || vocab.transformedContext) && (
        <div className="grid md:grid-cols-2 gap-2 mt-3">
          {vocab.originalContext && vocab.originalContext !== '-' && (
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">원문</p>
              <p className="text-sm text-slate-600">{vocab.originalContext}</p>
            </div>
          )}
          {vocab.transformedContext && vocab.transformedContext !== '-' && (
            <div className="bg-purple-50 rounded-lg p-3">
              <p className="text-xs text-slate-400 mb-1">변형</p>
              <p className="text-sm text-slate-600">{vocab.transformedContext}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  isExpanded,
  onToggle,
  isEditMode,
  isStudentPrintMode,
  comment,
  onSaveComment,
  onUpdateQuestion,
}: {
  question: AnalysisQuestion;
  isExpanded: boolean;
  onToggle: () => void;
  isEditMode: boolean;
  isStudentPrintMode: boolean;
  comment: string;
  onSaveComment: (comment: string) => void;
  onUpdateQuestion: (updates: Partial<AnalysisQuestion>) => void;
}) {
  const [commentText, setCommentText] = useState(comment);
  const [isSaved, setIsSaved] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    sourceType: question.sourceType,
    sourceName: question.sourceName,
    difficulty: question.difficulty,
    vocabularyChanges: [...question.vocabularyChanges],
  });

  const handleSaveComment = () => {
    onSaveComment(commentText);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleSaveEdit = () => {
    onUpdateQuestion({
      sourceType: editData.sourceType,
      sourceName: editData.sourceName,
      difficulty: editData.difficulty,
      vocabularyChanges: editData.vocabularyChanges,
      confidence: 100,
    });
    setIsEditing(false);
  };

  const addVocabulary = () => {
    setEditData({
      ...editData,
      vocabularyChanges: [
        ...editData.vocabularyChanges,
        { original: '', transformed: '', originalContext: '', transformedContext: '', tepsLevel: 850 },
      ],
    });
  };

  const removeVocabulary = (index: number) => {
    setEditData({
      ...editData,
      vocabularyChanges: editData.vocabularyChanges.filter((_, i) => i !== index),
    });
  };

  const updateVocabulary = (index: number, field: keyof VocabularyChange, value: string | number) => {
    const updated = [...editData.vocabularyChanges];
    updated[index] = { ...updated[index], [field]: value };
    setEditData({ ...editData, vocabularyChanges: updated });
  };

  const sourceColors: Record<string, string> = {
    direct: 'bg-green-100 text-green-700 border-green-200',
    indirect: 'bg-amber-100 text-amber-700 border-amber-200',
    external: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  const sourceLabels: Record<string, string> = {
    direct: '직접연계',
    indirect: '간접연계',
    external: '외부지문',
  };

  const difficultyColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-green-100 text-green-700',
  };

  const difficultyLabels: Record<string, string> = {
    high: '상',
    medium: '중',
    low: '하',
  };

  const questionTypeLabel = QUESTION_TYPE_LABELS[question.questionType as QuestionType] || question.questionType;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-slate-900">#{question.questionNumber}</span>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${sourceColors[question.sourceType]}`}>
            {sourceLabels[question.sourceType]}
          </span>
          <span className="text-sm text-slate-500">{questionTypeLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded-lg text-xs font-medium ${difficultyColors[question.difficulty]}`}>
            {difficultyLabels[question.difficulty]}
          </span>
          {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 border-t border-slate-100">
          <div className="py-4 space-y-4">
            {isEditMode && !isEditing && (
              <div className="flex justify-end no-print">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                  분석 수정
                </button>
              </div>
            )}

            {isEditing ? (
              <div className="space-y-4 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">연계 유형</label>
                    <div className="flex gap-2">
                      {(['direct', 'indirect', 'external'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setEditData({ ...editData, sourceType: type })}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            editData.sourceType === type ? sourceColors[type] : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {sourceLabels[type]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">난이도</label>
                    <div className="flex gap-2">
                      {(['high', 'medium', 'low'] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setEditData({ ...editData, difficulty: d })}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                            editData.difficulty === d ? difficultyColors[d] : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {difficultyLabels[d]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">출처</label>
                  <input
                    type="text"
                    value={editData.sourceName}
                    onChange={(e) => setEditData({ ...editData, sourceName: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
                    placeholder="예: 2024년 3월 모의고사 18번"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-slate-700">어휘 변형</label>
                    <button
                      onClick={addVocabulary}
                      className="flex items-center gap-1 text-sm text-yellow-600 hover:text-pink-800"
                    >
                      <Plus className="w-4 h-4" />
                      추가
                    </button>
                  </div>
                  <div className="space-y-2">
                    {editData.vocabularyChanges.map((v, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={v.original}
                          onChange={(e) => updateVocabulary(i, 'original', e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="원문 어휘"
                        />
                        <span className="text-slate-400">→</span>
                        <input
                          type="text"
                          value={v.transformed}
                          onChange={(e) => updateVocabulary(i, 'transformed', e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="변형 어휘"
                        />
                        <input
                          type="number"
                          value={v.tepsLevel}
                          onChange={(e) => updateVocabulary(i, 'tepsLevel', parseInt(e.target.value) || 0)}
                          className="w-20 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                          placeholder="TEPS"
                        />
                        <button
                          onClick={() => removeVocabulary(i)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSaveEdit}
                    className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600"
                  >
                    <Save className="w-4 h-4" />
                    저장
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditData({
                        sourceType: question.sourceType,
                        sourceName: question.sourceName,
                        difficulty: question.difficulty,
                        vocabularyChanges: [...question.vocabularyChanges],
                      });
                    }}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                <InfoRow label="출처" value={formatSourceName(question.sourceName, question.sourceNumber)} />

                {question.questionText && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-500 font-medium mb-2">📝 기출문제</p>
                    <div className="text-slate-800 whitespace-pre-wrap text-sm leading-relaxed">
                      {renderTextWithUnderline(question.questionText)}
                    </div>
                  </div>
                )}
                
                {question.transformationSummary && (
                  <div className="p-4 bg-yellow-50 rounded-xl">
                    <p className="text-sm text-yellow-600 font-medium mb-1">변형 패턴</p>
                    <p className="text-slate-800">{question.transformationSummary}</p>
                  </div>
                )}

                {(() => {
                  const actualChanges = (question.sentenceComparisons || []).filter(
                    sc => sc.originalSentence?.trim() !== sc.transformedSentence?.trim()
                  );
                  return actualChanges.length > 0 ? (
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-2">문장 변형</p>
                      {actualChanges.map((sc, i) => (
                        <div key={i} className="grid md:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl mb-2">
                          <div className="p-3 bg-white rounded-lg">
                            <p className="text-xs text-slate-400 mb-1">원문</p>
                            <p className="text-sm text-slate-700">{sc.originalSentence}</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg">
                            <p className="text-xs text-slate-400 mb-1">변형</p>
                            <p className="text-sm text-slate-900 font-medium">{sc.transformedSentence}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null;
                })()}

                {question.grammarChoices && question.grammarChoices.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-2">어법 분석</p>
                    <div className="space-y-2">
                      {question.grammarChoices.map((gc, i) => (
                        <div key={i} className={`p-3 rounded-xl border ${gc.isCorrect ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${gc.isCorrect ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-700'}`}>
                              {gc.choiceNumber}
                            </span>
                            <span className="font-medium text-slate-900">{gc.content}</span>
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{gc.grammaticalFocus}</span>
                            {gc.isCorrect && <span className="px-2 py-0.5 bg-green-600 text-white rounded text-xs">정답</span>}
                          </div>
                          <p className="text-sm text-slate-600 ml-8">{gc.explanation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {question.vocabularyChanges && question.vocabularyChanges.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-2">어휘 변형</p>
                    <div className="flex flex-wrap gap-2">
                      {question.vocabularyChanges.map((v, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                          <span className="font-semibold text-slate-900">{v.original}</span>
                          <span className="text-slate-400">→</span>
                          <span className="font-semibold text-purple-600">{v.transformed}</span>
                          {v.tepsLevel > 0 && <span className="text-xs text-amber-600 ml-1">({v.tepsLevel})</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {question.teacherIntent && (
                  <div className="p-4 bg-indigo-50 rounded-xl">
                    <p className="text-sm text-indigo-600 font-medium mb-1">출제 의도</p>
                    <p className="text-slate-800">{question.teacherIntent}</p>
                  </div>
                )}

                {question.answerRationale && (
                  <div className="p-4 bg-green-50 rounded-xl">
                    <p className="text-sm text-green-600 font-medium mb-1">정답 근거</p>
                    <p className="text-slate-800">{question.answerRationale}</p>
                  </div>
                )}

                {question.wrongAnswerAnalysis && question.wrongAnswerAnalysis.length > 0 && (
                  <div className="p-4 bg-red-50 rounded-xl">
                    <p className="text-sm text-red-600 font-medium mb-2">오답 분석</p>
                    <div className="space-y-2">
                      {question.wrongAnswerAnalysis.map((wa, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="w-6 h-6 rounded-full bg-red-200 text-red-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {wa.choice}
                          </span>
                          <p className="text-sm text-slate-700">{wa.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {question.studyRecommendations && question.studyRecommendations.length > 0 && (
                  <div className="p-4 bg-teal-50 rounded-xl">
                    <p className="text-sm text-teal-600 font-medium mb-2">학습 방법</p>
                    <ul className="space-y-1">
                      {question.studyRecommendations.map((rec, i) => (
                        <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs flex-shrink-0">{i + 1}</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {!isStudentPrintMode && !isEditMode && comment && (
              <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <p className="text-sm text-yellow-600 font-medium mb-1">선생님 코멘트</p>
                <p className="text-slate-800 whitespace-pre-wrap">{comment}</p>
              </div>
            )}

            {isEditMode && !isEditing && (
              <div className="pt-4 border-t border-slate-200 no-print">
                <label className="block text-sm font-medium text-slate-700 mb-2">선생님 코멘트</label>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-slate-900 bg-white resize-none"
                  rows={3}
                  placeholder="학생들에게 전달할 코멘트..."
                />
                <div className="flex items-center justify-end gap-3 mt-2">
                  {isSaved && (
                    <span className="text-green-600 text-sm flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      저장됨
                    </span>
                  )}
                  <button
                    onClick={handleSaveComment}
                    className="px-4 py-2 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600"
                  >
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm text-slate-500 w-16">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
