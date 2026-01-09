'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Database,
  CheckCircle2,
  Sparkles,
  FileText,
  BookOpen,
  Brain,
  Save,
  List,
} from 'lucide-react';

interface ExplanationResult {
  id: string;
  ocr_result_id: string;
  explanations: unknown[];
  status: string;
  created_at: string;
  ocr_results: {
    id: string;
    questions: unknown[];
    exams: {
      school_name: string;
      grade: string;
      exam_name: string;
    };
  };
}

type ProgressStep = {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: 'pending' | 'processing' | 'done';
};

export default function SelectPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [explanationResults, setExplanationResults] = useState<ExplanationResult[]>([]);
  const [selectedExplanation, setSelectedExplanation] = useState<ExplanationResult | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);

  useEffect(() => {
    const fetchExplanations = async () => {
      try {
        const response = await fetch('/api/ocr-results');
        const result = await response.json();
        if (result.success) {
          setExplanationResults(result.data);
        }
      } catch (error) {
        console.error('Failed to fetch explanations:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchExplanations();
  }, []);

  const updateStepStatus = (stepId: string, status: 'pending' | 'processing' | 'done') => {
    setProgressSteps(prev => 
      prev.map(step => step.id === stepId ? { ...step, status } : step)
    );
  };

  const handleAnalyze = async () => {
    if (!selectedExplanation) return;

    setIsSubmitting(true);
    
    const initialSteps: ProgressStep[] = [
      { id: 'extract', label: '지문 텍스트 추출', icon: <FileText className="w-4 h-4" />, status: 'pending' },
      { id: 'cefr', label: '어휘 난이도 분석 (CEFR)', icon: <BookOpen className="w-4 h-4" />, status: 'pending' },
      { id: 'gemini', label: '어휘 상세 정보 생성 (AI)', icon: <Brain className="w-4 h-4" />, status: 'pending' },
    ];
    setProgressSteps(initialSteps);

    try {
      updateStepStatus('extract', 'processing');
      await new Promise(resolve => setTimeout(resolve, 500));
      updateStepStatus('extract', 'done');
      
      updateStepStatus('cefr', 'processing');

      const responsePromise = fetch('/api/analyzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          explanation_id: selectedExplanation.id,
        }),
      });

      await new Promise(resolve => setTimeout(resolve, 1000));
      updateStepStatus('cefr', 'done');
      
      updateStepStatus('gemini', 'processing');

      const response = await responsePromise;
      const result = await response.json();

      updateStepStatus('gemini', 'done');

      if (result.success) {
        sessionStorage.setItem('analyzer_preview', JSON.stringify(result.data));
        await new Promise(resolve => setTimeout(resolve, 500));
        router.push('/analyzer/preview');
      } else {
        alert(result.error || '분석 시작에 실패했습니다.');
        setProgressSteps([]);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      alert('분석 중 오류가 발생했습니다.');
      setProgressSteps([]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-slate-900 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div
              onClick={() => window.location.reload()}
              className="flex items-center gap-3 cursor-pointer"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">Exam Voca Extractor</span>
            </div>
          </div>
          <Link 
            href="/analyzer/list" 
            className="flex items-center gap-2 text-slate-500 hover:text-pink-600 transition-colors"
          >
            <List className="w-5 h-5" />
            <span className="text-sm font-medium">목록</span>
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">해설 결과 선택</h2>
              <p className="text-sm text-slate-500">어휘 추출할 시험을 선택하세요</p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-pink-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-500">해설 결과 불러오는 중...</p>
            </div>
          ) : explanationResults.length === 0 ? (
            <div className="py-12 text-center">
              <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">생성된 해설이 없습니다.</p>
              <p className="text-sm text-slate-400 mt-1">먼저 exam-explanation에서 해설을 생성해주세요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {explanationResults.map((exp) => (
                <div
                  key={exp.id}
                  onClick={() => !isSubmitting && setSelectedExplanation(exp)}
                  className={`p-4 border rounded-xl transition-all ${
                    isSubmitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  } ${
                    selectedExplanation?.id === exp.id
                      ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-500/20'
                      : 'border-slate-200 hover:border-pink-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {selectedExplanation?.id === exp.id && (
                        <CheckCircle2 className="w-5 h-5 text-pink-600" />
                      )}
                      <div>
                        <h3 className="font-semibold text-slate-900">
                          {exp.ocr_results?.exams?.school_name || '학교명 없음'}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {exp.ocr_results?.exams?.grade} · {exp.ocr_results?.exams?.exam_name} · {(exp.explanations as unknown[])?.length || 0}문항
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-slate-400">{formatDate(exp.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {progressSteps.length > 0 && (
            <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-slate-900">📊 분석 진행 상황</h3>
                <span className="text-sm font-bold text-pink-600">
                  {Math.round((progressSteps.filter(s => s.status === 'done').length / progressSteps.length) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden mb-4">
                <div 
                  className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${(progressSteps.filter(s => s.status === 'done').length / progressSteps.length) * 100}%` 
                  }}
                />
              </div>
              <div className="space-y-3">
                {progressSteps.map((step) => (
                  <div key={step.id} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      step.status === 'done' 
                        ? 'bg-green-100 text-green-600' 
                        : step.status === 'processing'
                        ? 'bg-pink-100 text-pink-600'
                        : 'bg-slate-100 text-slate-400'
                    }`}>
                      {step.status === 'done' ? (
                        <CheckCircle2 className="w-4 h-4" />
                      ) : step.status === 'processing' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        step.icon
                      )}
                    </div>
                    <span className={`text-sm ${
                      step.status === 'done' 
                        ? 'text-green-700 font-medium' 
                        : step.status === 'processing'
                        ? 'text-pink-700 font-medium'
                        : 'text-slate-500'
                    }`}>
                      {step.label}
                      {step.status === 'processing' && '...'}
                      {step.status === 'done' && ' ✓'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end pt-6 mt-6 border-t border-slate-100">
            <button
              onClick={handleAnalyze}
              disabled={!selectedExplanation || isSubmitting}
              className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-400 hover:to-rose-500 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-pink-500/25 disabled:shadow-none"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  추출 중...
                </>
              ) : (
                <>
                  어휘 추출 시작
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-6 bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-5 border border-pink-200">
          <h3 className="font-semibold text-slate-900 mb-2">📚 Exam Voca Extractor란?</h3>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• 🔍 시험지에서 출제 핵심 어휘 자동 추출</li>
            <li>• ✏️ 빠진 어휘 수동 추가 가능</li>
            <li>• 📖 뜻, 발음기호, 어원 AI 자동 생성</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
