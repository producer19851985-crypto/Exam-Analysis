'use client';

import { useState, useEffect } from 'react';
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

interface AnalysisStep {
  id: string;
  label: string;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  details?: string[];
}

export default function AnalyzePage() {
  const params = useParams();
  const router = useRouter();
  const reportId = params.id as string;

  const [steps, setSteps] = useState<AnalysisStep[]>([
    {
      id: 'ocr',
      label: 'PDF 텍스트 추출',
      description: '기출문제와 원문에서 텍스트를 추출합니다.',
      status: 'processing',
      progress: 0,
      details: [],
    },
    {
      id: 'matching',
      label: '원문 매칭',
      description: 'Gemini 3 Pro로 기출문제와 원문을 매칭합니다.',
      status: 'pending',
    },
    {
      id: 'analyzing',
      label: '변형 분석',
      description: '어휘 변형, 구조 변형, 난이도를 분석합니다.',
      status: 'pending',
    },
    {
      id: 'generating',
      label: '리포트 생성',
      description: '통합 보고서와 문항별 분석을 생성합니다.',
      status: 'pending',
    },
  ]);

  const [overallProgress, setOverallProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(900);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setSteps((prev) => {
        const newSteps = [...prev];
        const currentStepIndex = newSteps.findIndex((s) => s.status === 'processing');

        if (currentStepIndex === -1) return prev;

        const currentStep = newSteps[currentStepIndex];
        const newProgress = (currentStep.progress || 0) + Math.random() * 15;

        if (newProgress >= 100) {
          currentStep.status = 'completed';
          currentStep.progress = 100;

          if (currentStepIndex < newSteps.length - 1) {
            newSteps[currentStepIndex + 1].status = 'processing';
            newSteps[currentStepIndex + 1].progress = 0;
          } else {
            setTimeout(() => {
              router.push(`/report/${reportId}`);
            }, 1000);
          }
        } else {
          currentStep.progress = newProgress;

          if (currentStep.id === 'ocr') {
            currentStep.details = [
              '✓ 기출문제 OCR 완료 (30문항 인식)',
              newProgress > 30 ? '✓ 2024년 3월 모의고사 추출 완료' : '🔄 2024년 3월 모의고사 추출 중...',
              newProgress > 60 ? '✓ 2023년 11월 모의고사 추출 완료' : '',
              newProgress > 80 ? '✓ 교과서 Lesson 3 추출 완료' : '',
            ].filter(Boolean);
          } else if (currentStep.id === 'matching') {
            const matchedCount = Math.floor(newProgress / 3.33);
            currentStep.details = [
              `✓ 1-10번 문제 매칭 완료`,
              matchedCount > 10 ? '✓ 11-20번 문제 매칭 완료' : `🔄 ${Math.min(matchedCount, 20)}번 문제 매칭 중...`,
              matchedCount > 20 ? '✓ 21-30번 문제 매칭 완료' : '',
            ].filter(Boolean);
          } else if (currentStep.id === 'analyzing') {
            currentStep.details = [
              newProgress > 20 ? '✓ 어휘 변형 분석 완료' : '🔄 어휘 변형 분석 중...',
              newProgress > 50 ? '✓ 문장 구조 분석 완료' : '',
              newProgress > 80 ? '✓ 난이도 평가 완료' : '',
            ].filter(Boolean);
          }
        }

        return newSteps;
      });

      setOverallProgress((prev) => {
        const completedSteps = steps.filter((s) => s.status === 'completed').length;
        const currentStep = steps.find((s) => s.status === 'processing');
        const currentProgress = currentStep?.progress || 0;
        return Math.min(100, (completedSteps * 25) + (currentProgress / 4));
      });

      setEstimatedTime((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [reportId, router, steps]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  const isCompleted = steps.every((s) => s.status === 'completed');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Loader2 className={`w-6 h-6 text-blue-600 ${!isCompleted ? 'animate-spin' : ''}`} />
            <span className="text-lg font-semibold text-slate-900">
              {isCompleted ? '분석 완료!' : '분석 진행 중...'}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border p-8 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">분석 진행 상황</h1>
              <p className="text-slate-500 mt-1">리포트 ID: {reportId}</p>
            </div>
            {!isCompleted && (
              <div className="text-right">
                <p className="text-sm text-slate-500">예상 남은 시간</p>
                <p className="text-2xl font-bold text-blue-600">{formatTime(estimatedTime)}</p>
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
                className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-500"
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

        <div className="bg-slate-100 rounded-xl p-6 mt-8">
          <p className="text-sm text-slate-600 text-center">
            분석이 완료되면 자동으로 리포트 페이지로 이동합니다.
            <br />
            창을 닫아도 분석은 계속 진행됩니다.
          </p>
        </div>
      </main>
    </div>
  );
}

function StepCard({ step, index }: { step: AnalysisStep; index: number }) {
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
          <p
            className={`text-sm mt-1 ${
              step.status === 'pending' ? 'text-slate-400' : 'text-slate-600'
            }`}
          >
            {step.description}
          </p>

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

          {step.details && step.details.length > 0 && (
            <div className="mt-3 space-y-1">
              {step.details.map((detail, i) => (
                <p key={i} className="text-sm text-slate-600">
                  {detail}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
