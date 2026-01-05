'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Send,
  Edit3,
  Save,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';

interface VocabularyChange {
  original: string;
  transformed: string;
  originalContext: string;
  transformedContext: string;
  tepsLevel: number;
}

interface SentenceComparison {
  original: string;
  transformed: string;
  changeType: string;
  explanation: string;
}

interface GrammarPoint {
  choiceNumber: number;
  content: string;
  grammaticalFocus: string;
  isCorrect: boolean;
  explanation: string;
}

interface DetailedAnalysis {
  questionNumber: number;
  sourceType: 'direct' | 'indirect' | 'external';
  sourceName: string;
  questionType: string;
  originalType?: string;
  difficulty: 'high' | 'medium' | 'low';
  sentenceComparisons: SentenceComparison[];
  vocabularyChanges: VocabularyChange[];
  grammarPoints?: GrammarPoint[];
  transformationSummary: string;
  teacherIntent: string;
  answerRationale: string;
  studyTips: string[];
}

interface AnalysisData {
  status: string;
  step: string;
  progress: number;
  analysis?: DetailedAnalysis[];
  rejectionFeedback?: string;
  error?: string;
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;

  const [data, setData] = useState<AnalysisData | null>(null);
  const [editedAnalysis, setEditedAnalysis] = useState<DetailedAnalysis[]>([]);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/analyze/${reportId}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        if (result.data.analysis && editedAnalysis.length === 0) {
          setEditedAnalysis(result.data.analysis);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, [reportId, editedAnalysis.length]);

  const updateDifficulty = (questionNumber: number, difficulty: 'high' | 'medium' | 'low') => {
    setEditedAnalysis(prev => 
      prev.map(item => 
        item.questionNumber === questionNumber 
          ? { ...item, difficulty } 
          : item
      )
    );
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (data?.status === 'analyzing') {
        fetchData();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchData, data?.status]);

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

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/analyze/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });

      const result = await response.json();
      if (result.success) {
        if (editedAnalysis.length > 0) {
          await fetch(`/api/analyze/${reportId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'update_analysis', analysis: editedAnalysis }),
          });
        }

        const publishResponse = await fetch(`/api/analyze/${reportId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'publish' }),
        });

        const publishResult = await publishResponse.json();
        if (publishResult.success) {

          router.push(`/report/${reportId}`);
        } else {
          alert(publishResult.error || '게시에 실패했습니다.');
        }
      } else {
        alert(result.error || '승인에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to approve:', error);
      alert('오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectFeedback.trim()) {
      alert('반려 사유를 입력해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/analyze/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', feedback: rejectFeedback }),
      });

      const result = await response.json();
      if (result.success) {
        setShowRejectModal(false);
        setRejectFeedback('');
        fetchData();
      } else {
        alert(result.error || '반려에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to reject:', error);
      alert('오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (data.status === 'analyzing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="text-lg font-bold text-slate-900">상세 분석 중</span>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-20">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/25">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{data.step}</h1>
            <p className="text-slate-500 mb-8">확정된 매칭을 기반으로 상세 분석을 진행하고 있습니다...</p>
            
            <div className="max-w-md mx-auto">
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-600 to-purple-600 transition-all duration-500"
                  style={{ width: `${data.progress}%` }}
                />
              </div>
              <p className="text-sm text-slate-400 mt-2">{data.progress}% 완료</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center shadow-sm">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">오류가 발생했습니다</h1>
          <p className="text-slate-500 mb-6">{data.error}</p>
          <Link
            href={`/match/${reportId}`}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
          >
            매칭 검토로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const analysis = editedAnalysis.length > 0 ? editedAnalysis : (data.analysis || []);

  const sourceTypeLabels: Record<string, string> = {
    direct: '직접연계',
    indirect: '간접연계',
    external: '외부지문',
  };

  const sourceTypeColors: Record<string, string> = {
    direct: 'bg-green-100 text-green-700 border-green-200',
    indirect: 'bg-amber-100 text-amber-700 border-amber-200',
    external: 'bg-purple-100 text-purple-700 border-purple-200',
  };

  const difficultyLabels: Record<string, string> = {
    high: '상',
    medium: '중',
    low: '하',
  };

  const difficultyColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-green-100 text-green-700',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/match/${reportId}`} className="text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">분석 결과 검토</span>
            </div>
          </div>
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        {data.status === 'rejected' && data.rejectionFeedback && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">반려됨</p>
                <p className="text-red-700 text-sm mt-1">{data.rejectionFeedback}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-blue-800 text-sm">
            AI가 생성한 상세 분석 결과입니다. 내용을 검토하고 <strong>승인</strong> 또는 <strong>반려</strong>해주세요.
            승인하면 바로 게시되어 학생들이 열람할 수 있습니다.
          </p>
        </div>

        <div className="space-y-4">
          {analysis.map((item) => (
            <div
              key={item.questionNumber}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
            >
              <button
                onClick={() => toggleQuestion(item.questionNumber)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-slate-900">#{item.questionNumber}</span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${sourceTypeColors[item.sourceType]}`}>
                    {sourceTypeLabels[item.sourceType]}
                  </span>
                  <span className="text-sm text-slate-500">{item.questionType}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium ${difficultyColors[item.difficulty]}`}>
                    {difficultyLabels[item.difficulty]}
                  </span>
                  {expandedQuestions.has(item.questionNumber) ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {expandedQuestions.has(item.questionNumber) && (
                <div className="px-6 pb-6 border-t border-slate-100 space-y-4 pt-4">
                  <div className="flex items-center justify-between">
                    <InfoRow label="출처" value={item.sourceName} />
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-500">난이도:</span>
                      {(['high', 'medium', 'low'] as const).map((d) => (
                        <button
                          key={d}
                          onClick={(e) => {
                            e.stopPropagation();
                            updateDifficulty(item.questionNumber, d);
                          }}
                          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                            item.difficulty === d
                              ? difficultyColors[d]
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {difficultyLabels[d]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {item.transformationSummary && (
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <p className="text-sm text-blue-600 font-medium mb-1">변형 패턴</p>
                      <p className="text-slate-800">{item.transformationSummary}</p>
                    </div>
                  )}

                  {item.sentenceComparisons.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-2">문장 변형</p>
                      {item.sentenceComparisons.map((sc, i) => (
                        <div key={i} className="grid md:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl mb-2">
                          <div className="p-3 bg-white rounded-lg">
                            <p className="text-xs text-slate-400 mb-1">원문</p>
                            <p className="text-sm text-slate-700">{sc.original}</p>
                          </div>
                          <div className="p-3 bg-white rounded-lg">
                            <p className="text-xs text-slate-400 mb-1">변형</p>
                            <p className="text-sm text-slate-900 font-medium">{sc.transformed}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {item.vocabularyChanges.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-2">어휘 변형</p>
                      <div className="flex flex-wrap gap-2">
                        {item.vocabularyChanges.map((v, i) => (
                          <span key={i} className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                            <span className="font-semibold text-slate-900">{v.original}</span>
                            <span className="text-slate-400">→</span>
                            <span className="font-semibold text-purple-600">{v.transformed}</span>
                            <span className="text-xs text-amber-600 ml-1">({v.tepsLevel})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.grammarPoints && item.grammarPoints.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-500 mb-2">어법 분석</p>
                      <div className="space-y-2">
                        {item.grammarPoints.map((gp, i) => (
                          <div key={i} className={`p-3 rounded-xl border ${gp.isCorrect ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${gp.isCorrect ? 'bg-green-600 text-white' : 'bg-slate-300 text-slate-700'}`}>
                                {gp.choiceNumber}
                              </span>
                              <span className="font-medium text-slate-900">{gp.content}</span>
                              <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{gp.grammaticalFocus}</span>
                              {gp.isCorrect && <span className="px-2 py-0.5 bg-green-600 text-white rounded text-xs">정답</span>}
                            </div>
                            <p className="text-sm text-slate-600 ml-8">{gp.explanation}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.teacherIntent && (
                    <div className="p-4 bg-indigo-50 rounded-xl">
                      <p className="text-sm text-indigo-600 font-medium mb-1">출제 의도</p>
                      <p className="text-slate-800">{item.teacherIntent}</p>
                    </div>
                  )}

                  {item.answerRationale && (
                    <div className="p-4 bg-green-50 rounded-xl">
                      <p className="text-sm text-green-600 font-medium mb-1">정답 근거</p>
                      <p className="text-slate-800">{item.answerRationale}</p>
                    </div>
                  )}

                  {item.studyTips.length > 0 && (
                    <div className="p-4 bg-teal-50 rounded-xl">
                      <p className="text-sm text-teal-600 font-medium mb-2">학습 팁</p>
                      <ul className="space-y-1">
                        {item.studyTips.map((tip, i) => (
                          <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs flex-shrink-0">{i + 1}</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-between items-center">
          <div className="text-sm text-slate-500">
            총 {analysis.length}개 문항 분석 완료
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-3 border border-red-200 text-red-600 rounded-xl font-semibold hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <XCircle className="w-4 h-4" />
              반려
            </button>
            <button
              onClick={handleApprove}
              disabled={isSubmitting || analysis.length === 0}
              className="flex items-center gap-2 bg-gradient-to-r from-green-600 to-teal-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-green-500 hover:to-teal-500 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/25 disabled:shadow-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  승인 및 게시
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">반려 사유 입력</h2>
            </div>
            
            <textarea
              value={rejectFeedback}
              onChange={(e) => setRejectFeedback(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none text-slate-900 bg-white resize-none"
              rows={4}
              placeholder="어떤 부분을 수정해야 하는지 구체적으로 작성해주세요..."
            />

            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectFeedback('');
                }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={isSubmitting || !rejectFeedback.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                반려하기
              </button>
            </div>
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
