'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatSourceName } from '@/lib/utils';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Edit3,
  Save,
  RefreshCw,
  ChevronDown,
  BookOpen,
  FileText,
  Trash2,
} from 'lucide-react';

// 영어 문단만 들여쓰기하는 컴포넌트
function IndentedText({ text }: { text: string }) {
  if (!text) return <span>(AI 매칭 결과 없음 - 수정 버튼을 눌러 원문을 선택하세요)</span>;

  const paragraphs = text.split('\n');

  return (
    <>
      {paragraphs.map((para, idx) => {
        const trimmed = para.trim();
        // 영어로 시작하는 문단만 들여쓰기
        const isEnglish = /^[A-Za-z]/.test(trimmed);

        return (
          <span
            key={idx}
            style={isEnglish && trimmed.length > 0 ? { textIndent: '0.5em', display: 'block' } : { display: 'block' }}
          >
            {para}
            {idx < paragraphs.length - 1 && '\n'}
          </span>
        );
      })}
    </>
  );
}

interface MatchResult {
  questionNumber: number;
  questionText: string;
  sourceType: 'direct' | 'indirect' | 'external';
  sourceName: string;
  sourceNumber: number | null;
  sourceText: string;
  confidence: number;
  reasoning: string;
}

interface ExtractedSource {
  number: number;
  text: string;
}

interface SourceFile {
  name: string;
  texts: ExtractedSource[];
}

interface AnalysisData {
  status: string;
  step: string;
  progress: number;
  matches?: MatchResult[];
  sources?: SourceFile[];
  error?: string;
}

export default function MatchReviewPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;

  const [data, setData] = useState<AnalysisData | null>(null);
  const [editedMatches, setEditedMatches] = useState<MatchResult[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingSourceIndex, setEditingSourceIndex] = useState<number | null>(null);

  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/analyze/${reportId}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        // 처음 로드 시에만 matches 설정
        if (result.data.matches && !initialLoadDone) {
          const sortedMatches = [...result.data.matches].sort(
            (a, b) => a.questionNumber - b.questionNumber
          );
          setEditedMatches(sortedMatches);
          setInitialLoadDone(true);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, [reportId, initialLoadDone]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      if (data?.status === 'matching') {
        fetchData();
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchData, data?.status]);

  const updateMatch = (index: number, updates: Partial<MatchResult>) => {
    setEditedMatches((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...updates } : m))
    );
  };

  const selectSource = (index: number, sourceFile: SourceFile, sourceItem: ExtractedSource) => {
    const sourceName = sourceItem.number
      ? `${sourceFile.name} ${sourceItem.number}번`
      : sourceFile.name;
    updateMatch(index, {
      sourceName,
      sourceNumber: sourceItem.number,
      sourceText: sourceItem.text,
      sourceType: 'direct',
    });
  };

  const handleSaveOnly = async () => {
    setIsSaving(true);
    try {
      const matchesToSave = editedMatches.map((m) => ({
        questionNumber: m.questionNumber,
        questionText: m.questionText,
        sourceType: m.sourceType,
        sourceName: m.sourceName,
        sourceText: m.sourceText,
        confidence: m.confidence,
        reasoning: m.reasoning,
      }));

      const response = await fetch(`/api/analyze/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_matches',
          matches: matchesToSave,
        }),
      });

      const result = await response.json();
      if (result.success) {
        alert('저장되었습니다.');
      } else {
        alert(result.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to save matches:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmMatches = async () => {
    setIsSubmitting(true);
    try {
      const confirmedMatches = editedMatches.map((m) => ({
        questionNumber: m.questionNumber,
        questionText: m.questionText,
        sourceType: m.sourceType,
        sourceName: m.sourceName,
        sourceText: m.sourceText,
      }));

      const response = await fetch(`/api/analyze/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm_matches',
          confirmedMatches,
        }),
      });

      const result = await response.json();
      if (result.success) {
        router.push(`/review/${reportId}`);
      } else {
        alert(result.error || '매칭 확정에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to confirm matches:', error);
      alert('오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('이 분석을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      const response = await fetch(`/api/analyze/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_report' }),
      });

      const result = await response.json();
      if (result.success) {
        router.push('/');
      } else {
        alert(result.error || '삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Failed to delete report:', error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-yellow-600 animate-spin" />
      </div>
    );
  }

  if (data.status === 'matching') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="text-lg font-bold text-slate-900">매칭 분석 중</span>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-20">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-yellow-500/25">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{data.step}</h1>
            <p className="text-slate-500 mb-8">AI가 기출문제와 원문을 매칭하고 있습니다...</p>

            <div className="max-w-md mx-auto">
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-300 to-yellow-400 transition-all duration-500"
                  style={{ width: `${data.progress}%` }}
                />
              </div>
              <p className="text-sm text-slate-400 mt-2">{Math.round(data.progress)}% 완료</p>
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
            href="/upload"
            className="inline-flex items-center gap-2 bg-yellow-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-yellow-600 transition-colors"
          >
            다시 시도
          </Link>
        </div>
      </div>
    );
  }

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

  const availableSources = data.sources || [];
  const allSourceItems = availableSources.flatMap((sf) =>
    sf.texts.map((t) => ({ fileName: sf.name, ...t }))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">매칭 검토</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-3 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              새로고침
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              삭제
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
          <p className="text-yellow-800 text-sm">
            <strong>좌측</strong>: AI가 매칭한 원문 (편집 가능) | <strong>우측</strong>: DB의 기출문제 (편집 불가)
          </p>
          <p className="text-yellow-700 text-sm mt-1">
            원문이 잘못 매칭되었으면 드롭다운에서 다른 원문을 선택하거나 직접 수정하세요.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 px-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <BookOpen className="w-4 h-4 text-blue-600" />
            원문 (편집 가능)
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <FileText className="w-4 h-4 text-yellow-600" />
            기출문제 (DB)
          </div>
        </div>

        <div className="space-y-4">
          {editedMatches.map((match, index) => (
            <div
              key={match.questionNumber}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
            >
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-slate-900">#{match.questionNumber}</span>
                  <div className="flex gap-1">
                    {(['direct', 'indirect', 'external'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => updateMatch(index, { sourceType: type })}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                          match.sourceType === type
                            ? sourceTypeColors[type]
                            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {sourceTypeLabels[type]}
                      </button>
                    ))}
                  </div>
                </div>
                {match.confidence > 0 && (
                  <span className="text-xs text-slate-400">신뢰도 {match.confidence}%</span>
                )}
              </div>

                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                <div className="p-4">
                  {match.sourceType === 'external' ? (
                    <div className="h-full flex items-center justify-center bg-slate-50 rounded-xl p-8">
                      <p className="text-slate-400 text-center">외부지문 - 원문 없음</p>
                    </div>
                  ) : editingSourceIndex === index ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">원문 선택 (변경시)</label>
                        <select
                          value={match.sourceName}
                          onChange={(e) => {
                            const selected = allSourceItems.find(
                              (s) => `${s.fileName} ${s.number}번` === e.target.value
                            );
                            if (selected) {
                              updateMatch(index, {
                                sourceName: e.target.value,
                                sourceNumber: selected.number,
                                sourceText: selected.text,
                              });
                            }
                          }}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none"
                        >
                          <option value="">원문 선택...</option>
                          {allSourceItems.map((s) => (
                            <option key={`${s.fileName}-${s.number}`} value={`${s.fileName} ${s.number}번`}>
                              {s.fileName} {s.number}번
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">출처명</label>
                        <input
                          type="text"
                          value={match.sourceName}
                          onChange={(e) => updateMatch(index, { sourceName: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none"
                          placeholder="예: 2024년 3월 모의고사 18번"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">원문 텍스트</label>
                        <textarea
                          value={match.sourceText}
                          onChange={(e) => updateMatch(index, { sourceText: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-900 bg-white focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none resize-none font-mono"
                          rows={10}
                          placeholder="원문 텍스트..."
                        />
                      </div>
                      <button
                        onClick={() => setEditingSourceIndex(null)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm hover:bg-yellow-600"
                      >
                        <Save className="w-3 h-3" />
                        완료
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-blue-600 font-medium">
                          {formatSourceName(match.sourceName, match.sourceNumber)}
                        </p>
                        <button
                          onClick={() => setEditingSourceIndex(index)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          수정
                        </button>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed text-justify">
                          <IndentedText text={match.sourceText} />
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="bg-yellow-50 rounded-xl p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed text-justify">
                      {match.questionText}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-between items-center">
          <div className="text-sm text-slate-500">
            총 {editedMatches.length}개 문항 |
            직접연계 {editedMatches.filter((m) => m.sourceType === 'direct').length}개 |
            간접연계 {editedMatches.filter((m) => m.sourceType === 'indirect').length}개 |
            외부지문 {editedMatches.filter((m) => m.sourceType === 'external').length}개
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveOnly}
              disabled={isSaving || editedMatches.length === 0}
              className="flex items-center gap-2 bg-white border border-slate-300 text-slate-700 px-6 py-3 rounded-xl font-semibold hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed transition-all"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  저장 중...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  저장만 하기
                </>
              )}
            </button>
            <button
              onClick={handleConfirmMatches}
              disabled={isSubmitting || editedMatches.length === 0}
              className="flex items-center gap-2 bg-gradient-to-r from-yellow-300 to-yellow-400 text-white px-8 py-3 rounded-xl font-semibold hover:from-pink-400 hover:to-rose-500 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-yellow-500/25 disabled:shadow-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  처리 중...
                </>
              ) : (
                <>
                  분석 시작
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
