'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
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
} from 'lucide-react';

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
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/analyze/${reportId}`);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        if (result.data.matches && editedMatches.length === 0) {
          setEditedMatches(result.data.matches);
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, [reportId, editedMatches.length]);

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
    updateMatch(index, {
      sourceName: `${sourceFile.name} ${sourceItem.number}번`,
      sourceNumber: sourceItem.number,
      sourceText: sourceItem.text,
    });
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

  if (!data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (data.status === 'matching') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <span className="text-lg font-bold text-slate-900">매칭 분석 중</span>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-20">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/25">
              <Loader2 className="w-10 h-10 text-white animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">{data.step}</h1>
            <p className="text-slate-500 mb-8">AI가 기출문제와 원문을 매칭하고 있습니다...</p>
            
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
            href="/upload"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">매칭 검토</span>
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
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-blue-800 text-sm">
            AI가 분석한 매칭 결과를 검토해주세요. 각 문항의 <strong>연계 유형</strong>과 <strong>출처</strong>를 수정할 수 있습니다.
            검토가 완료되면 &quot;매칭 확정&quot; 버튼을 눌러 상세 분석을 시작하세요.
          </p>
        </div>

        <div className="space-y-4">
          {editedMatches.map((match, index) => (
            <div
              key={match.questionNumber}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-slate-900">#{match.questionNumber}</span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${sourceTypeColors[match.sourceType]}`}>
                    {sourceTypeLabels[match.sourceType]}
                  </span>
                  {match.confidence > 0 && (
                    <span className="text-xs text-slate-400">신뢰도 {match.confidence}%</span>
                  )}
                </div>
                <button
                  onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    editingIndex === index
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Edit3 className="w-4 h-4" />
                  {editingIndex === index ? '닫기' : '수정'}
                </button>
              </div>

              <div className="px-6 py-4">
                <p className="text-sm text-slate-600 mb-3 line-clamp-3">{match.questionText.substring(0, 300)}...</p>
                
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-slate-400">출처:</span>
                  <span className="font-medium text-slate-900">{match.sourceName}</span>
                </div>

                {match.reasoning && (
                  <p className="text-xs text-slate-400 mt-2 italic">{match.reasoning}</p>
                )}
              </div>

              {editingIndex === index && (
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">연계 유형</label>
                    <div className="flex gap-2">
                      {(['direct', 'indirect', 'external'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => updateMatch(index, { sourceType: type })}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                            match.sourceType === type
                              ? sourceTypeColors[type]
                              : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          {sourceTypeLabels[type]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {match.sourceType !== 'external' && availableSources.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">원문 선택</label>
                      <div className="space-y-2">
                        {availableSources.map((sourceFile) => (
                          <div key={sourceFile.name} className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="bg-slate-100 px-4 py-2 font-medium text-slate-700 text-sm">
                              {sourceFile.name}
                            </div>
                            <div className="max-h-48 overflow-y-auto">
                              {sourceFile.texts.map((sourceItem) => (
                                <button
                                  key={`${sourceFile.name}-${sourceItem.number}`}
                                  onClick={() => selectSource(index, sourceFile, sourceItem)}
                                  className={`w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-slate-100 last:border-b-0 transition-colors ${
                                    match.sourceName === `${sourceFile.name} ${sourceItem.number}번`
                                      ? 'bg-blue-50 border-l-4 border-l-blue-500'
                                      : ''
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-slate-900">{sourceItem.number}번</span>
                                    {match.sourceName === `${sourceFile.name} ${sourceItem.number}번` && (
                                      <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                                    {sourceItem.text.substring(0, 100)}...
                                  </p>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      출처명 {match.sourceType !== 'external' && <span className="text-slate-400 font-normal">(직접 입력)</span>}
                    </label>
                    <input
                      type="text"
                      value={match.sourceName}
                      onChange={(e) => updateMatch(index, { sourceName: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 bg-white"
                      placeholder="예: 2024년 3월 모의고사 18번"
                    />
                  </div>

                  {match.sourceType !== 'external' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">원문 텍스트</label>
                      <textarea
                        value={match.sourceText}
                        onChange={(e) => updateMatch(index, { sourceText: e.target.value })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 bg-white resize-none"
                        rows={4}
                        placeholder="원문 지문을 입력하세요..."
                      />
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Save className="w-4 h-4" />
                      적용
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-between items-center">
          <div className="text-sm text-slate-500">
            총 {editedMatches.length}개 문항 | 
            직접연계 {editedMatches.filter(m => m.sourceType === 'direct').length}개 | 
            간접연계 {editedMatches.filter(m => m.sourceType === 'indirect').length}개 | 
            외부지문 {editedMatches.filter(m => m.sourceType === 'external').length}개
          </div>
          <button
            onClick={handleConfirmMatches}
            disabled={isSubmitting || editedMatches.length === 0}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-blue-500 hover:to-purple-500 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25 disabled:shadow-none"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                처리 중...
              </>
            ) : (
              <>
                매칭 확정
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
