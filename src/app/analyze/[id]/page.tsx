'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  FileText,
  CheckCircle2,
  Circle,
  Loader2,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';

interface AnalysisStatus {
  status: 'processing' | 'completed' | 'error';
  step: string;
  progress: number;
  result?: {
    questions: Array<{
      questionNumber: number;
      sourceType: string;
      sourceName: string;
      confidence: number;
      questionType: string;
      difficulty: string;
      vocabularyChanges: Array<{
        original: string;
        transformed: string;
        tepsLevel: number;
      }>;
    }>;
    summary: {
      total: number;
      direct: number;
      indirect: number;
      external: number;
      overallDifficulty: string;
    };
  };
  error?: string;
}

interface Step {
  id: string;
  label: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
}

export default function AnalyzePage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;

  const [analysisStatus, setAnalysisStatus] = useState<AnalysisStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([
    { id: 'OCR', label: 'PDF 텍스트 추출', status: 'processing', progress: 0 },
    { id: '매칭', label: '원문 매칭 (Gemini 3 Pro)', status: 'pending' },
    { id: '분석', label: '변형 분석', status: 'pending' },
    { id: '완료', label: '리포트 생성', status: 'pending' },
  ]);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/analyze/${reportId}`);
      const data = await response.json();

      if (data.success && data.data) {
        setAnalysisStatus(data.data);

        setSteps((prev) =>
          prev.map((step) => {
            if (step.id === data.data.step) {
              return { ...step, status: 'processing', progress: data.data.progress };
            } else if (
              prev.findIndex((s) => s.id === step.id) <
              prev.findIndex((s) => s.id === data.data.step)
            ) {
              return { ...step, status: 'completed', progress: 100 };
            } else if (data.data.status === 'completed') {
              return { ...step, status: 'completed', progress: 100 };
            }
            return step;
          })
        );

        if (data.data.status === 'completed' && data.data.result) {
          setTimeout(() => {
            router.push(`/report/${reportId}`);
          }, 1500);
        }

        if (data.data.status === 'error') {
          setError(data.data.error || '분석 중 오류가 발생했습니다.');
        }
      }
    } catch (err) {
      console.error('Fetch status error:', err);
    }
  }, [reportId, router]);

  useEffect(() => {
    let isMounted = true;
    
    const pollStatus = async () => {
      if (!isMounted) return;
      await fetchStatus();
    };
    
    pollStatus();
    const interval = setInterval(pollStatus, 2000);
    
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchStatus]);

  const isCompleted = analysisStatus?.status === 'completed';
  const hasError = analysisStatus?.status === 'error';

  const overallProgress = steps.reduce((acc, step) => {
    if (step.status === 'completed') return acc + 25;
    if (step.status === 'processing') return acc + ((step.progress || 0) / 4);
    return acc;
  }, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : hasError ? (
              <AlertCircle className="w-6 h-6 text-red-600" />
            ) : (
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            )}
            <span className="text-lg font-semibold text-slate-900">
              {isCompleted ? '분석 완료!' : hasError ? '분석 오류' : '분석 진행 중...'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">분석 진행 상황</h1>
              <p className="text-slate-500 mt-1">리포트 ID: {reportId.slice(0, 8)}...</p>
            </div>
            {!isCompleted && !hasError && (
              <div className="text-right">
                <p className="text-sm text-slate-500">현재 단계</p>
                <p className="text-lg font-bold text-blue-600">{analysisStatus?.step || 'OCR'}</p>
              </div>
            )}
          </div>

          <div className="mb-8">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-600">전체 진행률</span>
              <span className="font-medium text-slate-900">{Math.round(overallProgress)}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  hasError
                    ? 'bg-red-500'
                    : isCompleted
                    ? 'bg-green-500'
                    : 'bg-gradient-to-r from-blue-500 to-blue-600'
                }`}
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800">오류가 발생했습니다</p>
                <p className="text-sm text-red-600 mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {steps.map((step, index) => (
              <StepCard key={step.id} step={step} index={index} />
            ))}
          </div>
        </div>

        {isCompleted && (
          <div className="text-center">
            <Link
              href={`/report/${reportId}`}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              <FileText className="w-5 h-5" />
              리포트 보기
            </Link>
          </div>
        )}

        {!isCompleted && !hasError && (
          <div className="bg-slate-100 rounded-xl p-6 mt-8">
            <p className="text-sm text-slate-600 text-center">
              Gemini 3 Pro가 기출문제와 원문을 분석하고 있습니다.
              <br />
              약 2-5분 정도 소요됩니다. 창을 닫아도 분석은 계속 진행됩니다.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

function StepCard({ step, index }: { step: Step; index: number }) {
  const getIcon = () => {
    switch (step.status) {
      case 'completed':
        return <CheckCircle2 className="w-6 h-6 text-green-500" />;
      case 'processing':
        return <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      default:
        return <Circle className="w-6 h-6 text-slate-300" />;
    }
  };

  return (
    <div
      className={`rounded-xl border p-5 transition-colors ${
        step.status === 'processing'
          ? 'border-blue-200 bg-blue-50'
          : step.status === 'completed'
          ? 'border-green-200 bg-green-50'
          : step.status === 'error'
          ? 'border-red-200 bg-red-50'
          : 'border-slate-100 bg-slate-50'
      }`}
    >
      <div className="flex items-start gap-4">
        <div className="mt-0.5">{getIcon()}</div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h3
              className={`font-semibold ${
                step.status === 'pending' ? 'text-slate-400' : 'text-slate-900'
              }`}
            >
              {index + 1}단계: {step.label}
            </h3>
            {step.status === 'processing' && step.progress !== undefined && (
              <span className="text-sm font-medium text-blue-600">
                {Math.round(step.progress)}%
              </span>
            )}
          </div>

          {step.status === 'processing' && step.progress !== undefined && (
            <div className="mt-3">
              <div className="h-1.5 bg-blue-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${step.progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
