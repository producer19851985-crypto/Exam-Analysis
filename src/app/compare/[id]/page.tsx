'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { formatSourceName } from '@/lib/utils';
import {
  ArrowLeft,
  Loader2,
  AlertTriangle,
  BookOpen,
  FileText,
  Edit3,
  Save,
  X,
  ChevronDown,
  ChevronUp,
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

interface CompareData {
  matches: MatchResult[];
  examName?: string;
  schoolName?: string;
}

export default function ComparePage() {
  const params = useParams();
  const reportId = params.id as string;

  const [data, setData] = useState<CompareData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editedSourceText, setEditedSourceText] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/analyze/${reportId}`);
      const result = await response.json();
      
      if (result.success && result.data.matches) {
        const sortedMatches = [...result.data.matches].sort(
          (a, b) => a.questionNumber - b.questionNumber
        );
        setData({
          matches: sortedMatches,
          examName: result.data.examName,
          schoolName: result.data.schoolName,
        });
        setExpandedItems(new Set(sortedMatches.map(m => m.questionNumber)));
      } else {
        setError(result.error || '데이터를 불러올 수 없습니다.');
      }
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleExpand = (questionNumber: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(questionNumber)) {
        next.delete(questionNumber);
      } else {
        next.add(questionNumber);
      }
      return next;
    });
  };

  const startEditing = (index: number, currentText: string) => {
    setEditingIndex(index);
    setEditedSourceText(currentText);
  };

  const cancelEditing = () => {
    setEditingIndex(null);
    setEditedSourceText('');
  };

  const saveSourceText = async (questionNumber: number) => {
    if (!data) return;
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/analyze/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_source_text',
          questionNumber,
          sourceText: editedSourceText,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setData(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            matches: prev.matches.map(m =>
              m.questionNumber === questionNumber
                ? { ...m, sourceText: editedSourceText }
                : m
            ),
          };
        });
        setEditingIndex(null);
        setEditedSourceText('');
      } else {
        alert(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const sourceTypeLabels: Record<string, string> = {
    direct: '직접연계',
    indirect: '간접연계',
    external: '외부지문',
  };

  const sourceTypeColors: Record<string, string> = {
    direct: 'bg-green-100 text-green-700 border-green-200',
    indirect: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    external: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-yellow-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">데이터를 찾을 수 없습니다</h1>
          <p className="text-slate-500 mb-6">{error}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-yellow-500 text-white px-6 py-3 rounded-xl font-semibold hover:bg-yellow-600 transition-colors"
          >
            홈으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900">원문 vs 기출 비교</h1>
              <p className="text-sm text-slate-500">
                {data.schoolName && `${data.schoolName} `}
                {data.examName}
              </p>
            </div>
          </div>
          <div className="text-sm text-slate-500">
            총 {data.matches.length}개 문항
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-yellow-800 text-sm">
            📖 원문과 기출문제를 나란히 비교합니다. 
            <strong>원문(좌측)</strong>에 오류가 있으면 편집 버튼을 눌러 수정할 수 있습니다.
          </p>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 pb-12">
        <div className="space-y-6">
          {data.matches.map((match, index) => (
            <div
              key={match.questionNumber}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
            >
              <div 
                className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => toggleExpand(match.questionNumber)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-slate-900">
                    #{match.questionNumber}번
                  </span>
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${sourceTypeColors[match.sourceType]}`}>
                    {sourceTypeLabels[match.sourceType]}
                  </span>
                  {match.sourceType !== 'external' && match.sourceName && (
                    <span className="text-sm text-slate-500">
                      ← {formatSourceName(match.sourceName, match.sourceNumber)}
                    </span>
                  )}
                </div>
                {expandedItems.has(match.questionNumber) ? (
                  <ChevronUp className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                )}
              </div>

              {expandedItems.has(match.questionNumber) && (
                <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-yellow-600" />
                        <span className="font-semibold text-slate-700">원문</span>
                        {match.sourceName && (
                          <span className="text-xs text-slate-400">
                            ({formatSourceName(match.sourceName, match.sourceNumber)})
                          </span>
                        )}
                      </div>
                      {match.sourceType !== 'external' && (
                        editingIndex === index ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEditing();
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                saveSourceText(match.questionNumber);
                              }}
                              disabled={isSaving}
                              className="flex items-center gap-1 px-3 py-1.5 bg-yellow-500 text-white rounded-lg text-sm font-medium hover:bg-yellow-600 disabled:opacity-50 transition-colors"
                            >
                              {isSaving ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Save className="w-3 h-3" />
                              )}
                              저장
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(index, match.sourceText);
                            }}
                            className="flex items-center gap-1 px-2 py-1 text-slate-400 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors text-sm"
                          >
                            <Edit3 className="w-3 h-3" />
                            편집
                          </button>
                        )
                      )}
                    </div>
                    
                    {match.sourceType === 'external' ? (
                      <div className="text-slate-400 text-sm italic bg-slate-50 rounded-xl p-4 text-center">
                        외부지문 (원문 없음)
                      </div>
                    ) : editingIndex === index ? (
                      <textarea
                        value={editedSourceText}
                        onChange={(e) => setEditedSourceText(e.target.value)}
                        className="w-full h-64 px-4 py-3 border border-yellow-300 rounded-xl focus:ring-2 focus:ring-yellow-500 focus:border-transparent outline-none text-slate-800 text-sm leading-relaxed resize-none font-mono"
                        placeholder="원문 텍스트를 입력하세요..."
                      />
                    ) : (
                      <div className="bg-yellow-50/50 rounded-xl p-4 max-h-96 overflow-y-auto">
                        <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">
                          {match.sourceText || '원문 텍스트 없음'}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-6 bg-slate-50/50">
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="w-4 h-4 text-slate-600" />
                      <span className="font-semibold text-slate-700">기출문제</span>
                    </div>
                    <div className="bg-white rounded-xl p-4 border border-slate-200 max-h-96 overflow-y-auto">
                      <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                        {match.questionText}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
