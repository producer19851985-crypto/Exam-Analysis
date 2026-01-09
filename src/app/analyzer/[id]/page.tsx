'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  Loader2,
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Share2,
  ArrowLeft,
  Save,
  Plus,
  X,
  RefreshCw,
  Pencil,
} from 'lucide-react';
import { OverviewTab } from '@/components/report/OverviewTab';
import { ExplanationTab } from '@/components/report/ExplanationTab';
import { AnalyzerReport, OverviewData, VocabWordInfo } from '@/types/analyzer';

type TabType = 'overview' | 'explanation';

interface ExplanationQuestion {
  questionNumber: number;
  questionType: string;
  difficulty: 'high' | 'medium' | 'low';
  answerRationale: string;
  wrongAnswerAnalysis: Array<{ choice: string; reason: string }>;
  grammarPoints?: Array<{
    choiceNumber: number | string;
    content: string;
    grammaticalFocus: string;
    isCorrect: boolean;
    explanation: string;
  }>;
  keyVocabulary: Array<{ word: string; meaning: string; example?: string }>;
  studyTips: string[];
  translation?: string;
}

interface OcrQuestion {
  number: number;
  text: string;
  answer?: string;
}

export default function AnalyzerReportPage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const [report, setReport] = useState<AnalyzerReport | null>(null);
  const [questions, setQuestions] = useState<ExplanationQuestion[]>([]);
  const [ocrQuestions, setOcrQuestions] = useState<OcrQuestion[]>([]);
  const [overviewData, setOverviewData] = useState<OverviewData | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const [isEditMode, setIsEditMode] = useState(false);
  const [editedOverviewData, setEditedOverviewData] = useState<OverviewData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [manualWords, setManualWords] = useState<string[]>([]);

  useEffect(() => {
    loadReport();
  }, [reportId]);

  useEffect(() => {
    if (report?.status === 'processing') {
      const interval = setInterval(loadReport, 5000);
      return () => clearInterval(interval);
    }
  }, [report?.status]);

  const loadReport = async () => {
    try {
      const response = await fetch(`/api/analyzer/${reportId}`);
      const result = await response.json();

      if (!result.success) {
        setError(result.error || '리포트를 불러올 수 없습니다.');
        return;
      }

      const { report: reportData, explanation, ocrQuestions: ocrData } = result.data;

      setReport(reportData);
      setOverviewData(reportData.overview_data);
      setEditedOverviewData(reportData.overview_data);

      if (explanation?.questions) {
        setQuestions(explanation.questions);
      }
      if (ocrData) {
        setOcrQuestions(ocrData);
      }
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublish = async () => {
    if (!report) return;
    setIsPublishing(true);
    try {
      const response = await fetch(`/api/analyzer/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'published' }),
      });
      const result = await response.json();
      if (result.success) {
        setReport({ ...report, status: 'published' });
      }
    } catch (err) {
      console.error('게시 실패:', err);
    } finally {
      setIsPublishing(false);
    }
  };

  const copyShareLink = async () => {
    if (!report) return;
    const url = `${window.location.origin}/analyzer/${reportId}`;
    const text = `📚 ${report.school_name} ${report.exam_name} 분석 리포트\n\n🔗 링크: ${url}\n🔑 비밀번호: ${report.student_password}`;
    await navigator.clipboard.writeText(text);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleAddWord = () => {
    const word = newWord.trim().toLowerCase();
    if (!word) return;
    if (manualWords.includes(word)) return;
    if (editedOverviewData?.vocabList.some((v) => v.word.toLowerCase() === word)) return;

    setManualWords((prev) => [...prev, word]);
    setNewWord('');
  };

  const handleRemoveManualWord = (word: string) => {
    setManualWords((prev) => prev.filter((w) => w !== word));
  };

  const handleRemoveVocab = (word: string) => {
    if (!editedOverviewData) return;
    setEditedOverviewData({
      ...editedOverviewData,
      vocabList: editedOverviewData.vocabList.filter((v) => v.word !== word),
      hardVocabCount: editedOverviewData.hardVocabCount - 1,
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

      if (result.success && editedOverviewData) {
        const newVocabItems: VocabWordInfo[] = result.data.map(
          (d: { word: string; meaning: string; pronunciation: string; etymology: string }) => ({
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
          })
        );

        const updatedVocabList = [...editedOverviewData.vocabList, ...newVocabItems].sort((a, b) =>
          a.word.localeCompare(b.word)
        );

        setEditedOverviewData({
          ...editedOverviewData,
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

  const handleSaveEdit = async () => {
    if (!editedOverviewData) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/analyzer/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overview_data: editedOverviewData }),
      });
      const result = await response.json();

      if (result.success) {
        setOverviewData(editedOverviewData);
        setIsEditMode(false);
        alert('저장되었습니다.');
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

  const handleCancelEdit = () => {
    setEditedOverviewData(overviewData);
    setManualWords([]);
    setNewWord('');
    setIsEditMode(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-pink-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">리포트를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-8 text-center">
          <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold text-slate-900 mb-2">리포트를 찾을 수 없습니다</h1>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: '시험 오버뷰', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'explanation', label: '문제별 해설', icon: <BookOpen className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/analyzer/list" className="text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900">{report.school_name}</h1>
              <p className="text-sm text-slate-500">{report.exam_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {report.status === 'processing' && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm">
                <Loader2 className="w-4 h-4 animate-spin" />
                분석 중...
              </div>
            )}
            {!isEditMode && (
              <button
                onClick={() => setIsEditMode(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-all"
              >
                <Pencil className="w-4 h-4" />
                편집
              </button>
            )}
            {isEditMode && (
              <>
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-all"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:from-green-400 hover:to-emerald-500 transition-all shadow-lg shadow-green-500/25 disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  저장
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {!isEditMode ? (
          <>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-pink-500 to-rose-600 text-white shadow-lg shadow-pink-500/25'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'overview' && overviewData && <OverviewTab data={overviewData} />}
            {activeTab === 'explanation' && <ExplanationTab questions={questions} ocrQuestions={ocrQuestions} />}
          </>
        ) : (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-amber-800 text-sm">
                ✏️ <strong>편집 모드</strong>입니다. 어휘를 추가/삭제한 후 상단의 "저장" 버튼을 눌러주세요.
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-pink-600" />
                  출제 핵심 어휘 ({editedOverviewData?.vocabList.length || 0}개)
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
                    {editedOverviewData?.vocabList.map((vocab, index) => (
                      <tr key={index} className={`hover:bg-slate-50 ${vocab.isPhrase ? 'bg-violet-50/50' : ''}`}>
                        <td className="px-5 py-4 align-middle">
                          <span className="font-bold text-slate-900">{vocab.word}</span>
                          {vocab.isPhrase && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-violet-200 text-violet-700">
                              숙어
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 align-middle">
                          <div className="space-y-1">
                            {!vocab.isPhrase && (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                                  {vocab.pos}
                                </span>
                                {vocab.pronunciation && (
                                  <span className="text-slate-500 text-sm">{vocab.pronunciation}</span>
                                )}
                                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                  {vocab.cefr}
                                </span>
                              </div>
                            )}
                            {vocab.meaning ? (
                              <p className="text-slate-800 font-medium">{vocab.meaning}</p>
                            ) : (
                              <p className="text-slate-400 italic text-sm">뜻 정보 없음</p>
                            )}
                            {vocab.etymology && <p className="text-slate-500 text-sm">💡 {vocab.etymology}</p>}
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
          </div>
        )}
      </main>
    </div>
  );
}
