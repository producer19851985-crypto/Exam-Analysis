'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Loader2,
  AlertTriangle,
  BarChart3,
  BookOpen,
  Save,
  Plus,
  X,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { OverviewData, VocabWordInfo } from '@/types/analyzer';

interface PreviewData {
  preview: boolean;
  explanation_id: string;
  school_name: string;
  grade: string;
  exam_name: string;
  overview_data: OverviewData;
  explanation_questions: unknown[];
  ocr_questions: unknown[];
}

export default function AnalyzerPreviewPage() {
  const router = useRouter();
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [manualWords, setManualWords] = useState<string[]>([]);
  const [isSaveSuccess, setIsSaveSuccess] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('analyzer_preview');
    if (stored) {
      try {
        const data = JSON.parse(stored) as PreviewData;
        setPreviewData(data);
        setOverviewData(data.overview_data);
      } catch {
        console.error('Failed to parse preview data');
      }
    }
    setIsLoading(false);
  }, []);

  const handleAddWord = () => {
    const word = newWord.trim().toLowerCase();
    if (!word) return;
    if (manualWords.includes(word)) return;
    if (overviewData?.vocabList.some(v => v.word.toLowerCase() === word)) return;
    
    setManualWords(prev => [...prev, word]);
    setNewWord('');
  };

  const handleRemoveManualWord = (word: string) => {
    setManualWords(prev => prev.filter(w => w !== word));
  };

  const handleRemoveVocab = (word: string) => {
    if (!overviewData) return;
    setOverviewData({
      ...overviewData,
      vocabList: overviewData.vocabList.filter(v => v.word !== word),
      hardVocabCount: overviewData.hardVocabCount - 1,
    });
  };

  const handleReanalyze = async () => {
    if (manualWords.length === 0) return;
    
    setIsReanalyzing(true);
    try {
      const response = await fetch('/api/analyzer/vocab-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: manualWords }),
      });
      const result = await response.json();

      if (result.success && overviewData) {
        const newVocabItems: VocabWordInfo[] = result.data.map((d: { word: string; meaning: string; pronunciation: string; etymology: string }) => ({
          word: d.word,
          level: 5.0,
          cefr: 'C1',
          label: '수동 추가',
          emoji: '✏️',
          pos: '',
          meaning: d.meaning,
          pronunciation: d.pronunciation,
          etymology: d.etymology,
          isPhrase: d.word.includes(' '),
        }));

        const updatedVocabList = [...overviewData.vocabList, ...newVocabItems]
          .sort((a, b) => a.word.localeCompare(b.word));

        setOverviewData({
          ...overviewData,
          vocabList: updatedVocabList,
          hardVocabCount: updatedVocabList.length,
        });
        setManualWords([]);
      }
    } catch (error) {
      console.error('Reanalyze error:', error);
      alert('어휘 분석에 실패했습니다.');
    } finally {
      setIsReanalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!previewData || !overviewData) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/analyzer/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          explanation_id: previewData.explanation_id,
          school_name: previewData.school_name,
          grade: previewData.grade,
          exam_name: previewData.exam_name,
          student_password: '',
          edit_password: '',
          overview_data: overviewData,
        }),
      });
      const result = await response.json();

      if (result.success) {
        sessionStorage.removeItem('analyzer_preview');
        setIsSaveSuccess(true);
      } else {
        alert(result.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-pink-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">미리보기 로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!previewData || !overviewData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">미리보기 데이터 없음</h1>
          <p className="text-slate-500 mb-4">분석을 먼저 실행해주세요.</p>
          <button
            onClick={() => router.push('/select')}
            className="px-6 py-2 bg-pink-500 text-white rounded-xl hover:bg-pink-600"
          >
            분석 페이지로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900">Exam Voca Extractor</h1>
                <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded-full font-medium">미리보기</span>
              </div>
              <p className="text-sm text-slate-500">{previewData.school_name} · {previewData.exam_name}</p>
            </div>
          </div>
          {isSaveSuccess ? (
            <div className="flex items-center gap-2 px-5 py-2.5 bg-green-100 text-green-700 rounded-xl font-medium">
              <CheckCircle2 className="w-4 h-4" />
              저장 완료!
            </div>
          ) : (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/25 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              저장
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-600" />
              출제 핵심 어휘 ({overviewData.vocabList.length}개)
            </h2>
          </div>

          <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-3">어휘 수동 추가</h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newWord}
                onChange={(e) => setNewWord(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAddWord()}
                placeholder="단어 또는 숙어 입력 (예: at a cost of)"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none"
              />
              <button
                onClick={handleAddWord}
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            
            {manualWords.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {manualWords.map((word) => (
                    <span
                      key={word}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm"
                    >
                      {word}
                      <button onClick={() => handleRemoveManualWord(word)} className="hover:text-amber-900">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <button
                  onClick={handleReanalyze}
                  disabled={isReanalyzing}
                  className="flex items-center gap-2 px-4 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 disabled:opacity-50 transition-colors"
                >
                  {isReanalyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  재분석 (뜻/발음/어원 생성)
                </button>
              </div>
            )}
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-5 py-3 text-sm font-semibold text-slate-700 w-1/4">단어/숙어</th>
                  <th className="text-left px-5 py-3 text-sm font-semibold text-slate-700">뜻 · 발음 · 어원</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {overviewData.vocabList.map((vocab, index) => (
                  <tr key={index} className={`hover:bg-slate-50 ${vocab.isPhrase ? 'bg-violet-50/50' : ''}`}>
                    <td className="px-5 py-4 align-middle">
                      <span className="font-bold text-slate-900">{vocab.word}</span>
                      {vocab.isPhrase && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-violet-200 text-violet-700">숙어</span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-middle">
                      <div className="space-y-1">
                        {!vocab.isPhrase && (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">{vocab.pos}</span>
                            {vocab.pronunciation && (
                              <span className="text-slate-500 text-sm">{vocab.pronunciation}</span>
                            )}
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">{vocab.cefr}</span>
                          </div>
                        )}
                        {vocab.meaning ? (
                          <p className="text-slate-800 font-medium">{vocab.meaning}</p>
                        ) : (
                          <p className="text-slate-400 italic text-sm">뜻 정보 없음</p>
                        )}
                        {vocab.etymology && (
                          <p className="text-slate-500 text-sm">💡 {vocab.etymology}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4 align-middle">
                      <button
                        onClick={() => handleRemoveVocab(vocab.word)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="삭제"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-amber-800 text-sm">
            ⚠️ 이 페이지는 <strong>미리보기</strong>입니다. 상단의 "저장" 버튼을 눌러야 DB에 저장됩니다.
          </p>
        </div>
      </main>


    </div>
  );
}
