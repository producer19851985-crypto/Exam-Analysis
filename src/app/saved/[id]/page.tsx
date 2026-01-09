'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Save,
  Edit3,
  BookOpen,
  FileText,
  Play,
  Trash2,
  CheckCircle2,
} from 'lucide-react';

// 영어 문단만 들여쓰기하는 컴포넌트
function IndentedText({ text }: { text: string }) {
  if (!text) return <span>(원문 없음)</span>;

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

interface MatchData {
  question_number: number;
  question_text: string;
  source_type: 'direct' | 'indirect' | 'external';
  source_text: string;
  source_confidence: number;
  analysis: {
    source_name: string;
    reasoning: string;
  };
}

interface ReportData {
  id: string;
  school_name: string;
  grade: string;
  exam_name: string;
  status: string;
  created_at: string;
}

export default function SavedMatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;

  const [report, setReport] = useState<ReportData | null>(null);
  const [matches, setMatches] = useState<MatchData[]>([]);
  const [editedMatches, setEditedMatches] = useState<MatchData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`/api/saved-matches/${reportId}`);
      const result = await response.json();
      if (result.success) {
        setReport(result.data.report);
        const sortedMatches = [...result.data.questions].sort(
          (a: MatchData, b: MatchData) => a.question_number - b.question_number
        );
        setMatches(sortedMatches);
        setEditedMatches(sortedMatches);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const updateMatch = (index: number, updates: Partial<MatchData>) => {
    setEditedMatches((prev) =>
      prev.map((m, i) => (i === index ? { ...m, ...updates } : m))
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/analyze/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_matches',
          matches: editedMatches.map((m) => ({
            questionNumber: m.question_number,
            questionText: m.question_text,
            sourceType: m.source_type,
            sourceName: m.analysis?.source_name || '',
            sourceText: m.source_text,
            confidence: m.source_confidence,
            reasoning: m.analysis?.reasoning || '',
          })),
        }),
      });
      const result = await response.json();
      if (result.success) {
        setHasChanges(false);
        setMatches(editedMatches);
        alert('저장되었습니다.');
      } else {
        alert(result.error || '저장 실패');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('저장 중 오류 발생');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (hasChanges) {
      if (!confirm('변경사항이 있습니다. 저장하지 않고 분석을 시작하시겠습니까?')) {
        return;
      }
    }
    setIsStartingAnalysis(true);
    router.push(`/match/${reportId}`);
  };

  const handleDelete = async () => {
    if (!confirm('이 매칭 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
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
        router.push('/saved');
      } else {
        alert(result.error || '삭제 실패');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류 발생');
    }
  };

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">데이터를 찾을 수 없습니다.</p>
          <Link href="/saved" className="text-blue-600 hover:underline">
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/saved" className="text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <span className="text-lg font-bold text-slate-900">{report.school_name}</span>
                <p className="text-sm text-slate-500">{report.grade} · {report.exam_name}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
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
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-blue-800 text-sm">
            저장된 매칭 데이터를 확인하고 수정할 수 있습니다. 수정 후 <strong>저장</strong> 버튼을 눌러주세요.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 px-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <BookOpen className="w-4 h-4 text-blue-600" />
            원문 (편집 가능)
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            <FileText className="w-4 h-4 text-yellow-600" />
            기출문제
          </div>
        </div>

        <div className="space-y-4">
          {editedMatches.map((match, index) => (
            <div
              key={match.question_number}
              className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm"
            >
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-slate-900">#{match.question_number}</span>
                  <div className="flex gap-1">
                    {(['direct', 'indirect', 'external'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => updateMatch(index, { source_type: type })}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors border ${
                          match.source_type === type
                            ? sourceTypeColors[type]
                            : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {sourceTypeLabels[type]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                <div className="p-4">
                  {match.source_type === 'external' ? (
                    <div className="h-full flex items-center justify-center bg-slate-50 rounded-xl p-8">
                      <p className="text-slate-400 text-center">외부지문 - 원문 없음</p>
                    </div>
                  ) : editingIndex === index ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">출처명</label>
                        <input
                          type="text"
                          value={match.analysis?.source_name || ''}
                          onChange={(e) =>
                            updateMatch(index, {
                              analysis: { ...match.analysis, source_name: e.target.value },
                            })
                          }
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          placeholder="예: 2024년 3월 모의고사 18번"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">원문 텍스트</label>
                        <textarea
                          value={match.source_text || ''}
                          onChange={(e) => updateMatch(index, { source_text: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none font-mono"
                          rows={10}
                          placeholder="원문 텍스트..."
                        />
                      </div>
                      <button
                        onClick={() => setEditingIndex(null)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        완료
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-blue-600 font-medium">
                          {match.analysis?.source_name || '출처 미지정'}
                        </p>
                        <button
                          onClick={() => setEditingIndex(index)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded transition-colors"
                        >
                          <Edit3 className="w-3 h-3" />
                          수정
                        </button>
                      </div>
                      <div className="bg-blue-50 rounded-xl p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed text-justify">
                          <IndentedText text={match.source_text} />
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-4">
                  <div className="bg-yellow-50 rounded-xl p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                    <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed text-justify">
                      {match.question_text}
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
            직접연계 {editedMatches.filter((m) => m.source_type === 'direct').length}개 |
            간접연계 {editedMatches.filter((m) => m.source_type === 'indirect').length}개 |
            외부지문 {editedMatches.filter((m) => m.source_type === 'external').length}개
            {hasChanges && <span className="text-orange-600 ml-2">· 변경사항 있음</span>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
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
                  저장
                </>
              )}
            </button>
            <button
              onClick={handleStartAnalysis}
              disabled={isStartingAnalysis}
              className="flex items-center gap-2 bg-gradient-to-r from-green-500 to-green-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-green-600 hover:to-green-700 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/25 disabled:shadow-none"
            >
              {isStartingAnalysis ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  이동 중...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
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
