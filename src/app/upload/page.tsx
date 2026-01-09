'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import {
  FileText,
  Upload,
  X,
  ArrowLeft,
  ArrowRight,
  Loader2,
  BookOpen,
  GraduationCap,
  Sparkles,
  CheckCircle2,
  Database,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ExplanationResult {
  id: string;
  ocr_result_id: string;
  explanations: Array<{ number: number; explanation: string }>;
  status: string;
  created_at: string;
  ocr_results: {
    id: string;
    questions: Array<{ number: number; text: string; type?: string; answer?: string }>;
    exams: {
      school_name: string;
      grade: string;
      exam_name: string;
    };
  };
}

interface FileWithPreview extends File {
  preview?: string;
}

interface UploadedFiles {
  mock: FileWithPreview[];
  textbook: FileWithPreview[];
}

type Step = 'explanation' | 'sources' | 'settings';

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('explanation');
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [explanationResults, setExplanationResults] = useState<ExplanationResult[]>([]);
  const [selectedExplanation, setSelectedExplanation] = useState<ExplanationResult | null>(null);
  const [files, setFiles] = useState<UploadedFiles>({
    mock: [],
    textbook: [],
  });

  const [settings] = useState({});

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

  const onDropMock = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => ({
      ...prev,
      mock: [...prev.mock, ...acceptedFiles].slice(0, 2),
    }));
  }, []);

  const onDropTextbook = useCallback((acceptedFiles: File[]) => {
    setFiles((prev) => ({
      ...prev,
      textbook: [...prev.textbook, ...acceptedFiles].slice(0, 2),
    }));
  }, []);

  const mockDropzone = useDropzone({
    onDrop: onDropMock,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 2,
  });

  const textbookDropzone = useDropzone({
    onDrop: onDropTextbook,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 2,
  });

  const removeFile = (type: keyof UploadedFiles, index: number) => {
    setFiles((prev) => ({
      ...prev,
      [type]: prev[type].filter((_, i) => i !== index),
    }));
  };

  const canProceedToSources = selectedExplanation !== null;
  const canProceedToSettings = files.mock.length > 0 || files.textbook.length > 0;

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  };

  const uploadToStorage = async (file: File, reportId: string, fileType: string): Promise<string> => {
    if (!supabase) throw new Error('Supabase 연결 실패');
    const safeName = `${Date.now()}.pdf`;
    const filePath = `${reportId}/${fileType}/${safeName}`;
    const { error } = await supabase.storage.from('uploads').upload(filePath, file);
    if (error) throw new Error(`파일 업로드 실패: ${error.message}`);
    const { data } = supabase.storage.from('uploads').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async () => {
    if (!selectedExplanation) {
      alert('해설 결과를 선택해주세요.');
      return;
    }

    setIsUploading(true);

    try {
      const reportId = crypto.randomUUID();

      const sources: Array<{ name: string; base64: string }> = [];
      
      for (const file of files.mock) {
        const base64 = await fileToBase64(file);
        sources.push({ name: file.name.replace('.pdf', ''), base64 });
      }

      for (const file of files.textbook) {
        const base64 = await fileToBase64(file);
        sources.push({ name: file.name.replace('.pdf', ''), base64 });
      }

      const response = await fetch(`/api/analyze/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_from_explanation',
          explanationId: selectedExplanation.id,
          ocrResultId: selectedExplanation.ocr_result_id,
          sources,
          metadata: {
            school_name: selectedExplanation.ocr_results.exams.school_name,
            grade: selectedExplanation.ocr_results.exams.grade,
            exam_name: selectedExplanation.ocr_results.exams.exam_name,
          },
        }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/match/${reportId}`);
      } else {
        alert(data.error || '분석 시작에 실패했습니다.');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert(err instanceof Error ? err.message : '업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
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
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div
            onClick={() => window.location.reload()}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">Exam Analyzer</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link
          href="/saved"
          className="block bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 hover:bg-blue-100 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900">저장된 매칭 목록</h3>
              <p className="text-sm text-blue-700">이전에 저장한 원문 매칭 데이터를 확인하고 편집하거나 분석을 이어서 진행합니다.</p>
            </div>
            <ArrowRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <div className="flex items-center justify-center gap-4 mb-10">
          <StepIndicator step={1} label="해설 선택" active={step === 'explanation'} completed={step !== 'explanation'} />
          <div className="w-12 h-0.5 bg-slate-200" />
          <StepIndicator step={2} label="원문 업로드" active={step === 'sources'} completed={step === 'settings'} />
          <div className="w-12 h-0.5 bg-slate-200" />
          <StepIndicator step={3} label="설정" active={step === 'settings'} completed={false} />
        </div>

        {step === 'explanation' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-yellow-300 to-yellow-400 flex items-center justify-center text-white">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">해설 결과 선택</h2>
                <p className="text-sm text-slate-500">exam-explanation에서 생성된 해설을 선택하세요</p>
              </div>
            </div>

            {isLoading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 text-yellow-600 animate-spin mx-auto mb-4" />
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
                    onClick={() => setSelectedExplanation(exp)}
                    className={`p-4 border rounded-xl cursor-pointer transition-all ${
                      selectedExplanation?.id === exp.id
                        ? 'border-yellow-500 bg-yellow-50 ring-2 ring-yellow-500/20'
                        : 'border-slate-200 hover:border-yellow-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {selectedExplanation?.id === exp.id && (
                          <CheckCircle2 className="w-5 h-5 text-yellow-600" />
                        )}
                        <div>
                          <h3 className="font-semibold text-slate-900">
                            {exp.ocr_results?.exams?.school_name || '학교명 없음'}
                          </h3>
                          <p className="text-sm text-slate-500">
                            {exp.ocr_results?.exams?.grade} · {exp.ocr_results?.exams?.exam_name} · {exp.ocr_results?.questions?.length || 0}문항
                          </p>
                        </div>
                      </div>
                      <span className="text-sm text-slate-400">{formatDate(exp.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-6 mt-6 border-t border-slate-100">
              <button
                onClick={() => setStep('sources')}
                disabled={!canProceedToSources}
                className="flex items-center gap-2 bg-gradient-to-r from-yellow-300 to-yellow-400 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-400 hover:to-rose-500 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-yellow-500/25 disabled:shadow-none"
              >
                다음 단계
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'sources' && (
          <div className="space-y-6">
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-4 mb-6">
              <p className="text-pink-800 text-sm">
                <strong>{selectedExplanation?.ocr_results?.exams?.school_name}</strong> - {selectedExplanation?.ocr_results?.exams?.exam_name}의 원문을 업로드하세요.
                <br />
                모의고사나 교과서 PDF를 업로드하면 기출문제와 비교 분석합니다.
              </p>
            </div>

            <DropzoneSection
              title="모의고사 PDF"
              description="시험 범위 모의고사 (최대 2개)"
              icon={<GraduationCap className="w-6 h-6" />}
              dropzone={mockDropzone}
              files={files.mock}
              onRemove={(i) => removeFile('mock', i)}
              maxFiles={2}
              gradient="from-yellow-300 to-yellow-400"
            />

            <DropzoneSection
              title="교과서 PDF"
              description="시험 범위 교과서 (최대 2개)"
              icon={<BookOpen className="w-6 h-6" />}
              dropzone={textbookDropzone}
              files={files.textbook}
              onRemove={(i) => removeFile('textbook', i)}
              maxFiles={2}
              gradient="from-yellow-300 to-yellow-400"
            />

            <div className="flex justify-between pt-4">
              <button
                onClick={() => setStep('explanation')}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                이전 단계
              </button>
              <button
                onClick={() => setStep('settings')}
                disabled={!canProceedToSettings}
                className="flex items-center gap-2 bg-gradient-to-r from-yellow-300 to-yellow-400 text-white px-6 py-3 rounded-xl font-semibold hover:from-pink-400 hover:to-rose-500 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-yellow-500/25 disabled:shadow-none"
              >
                다음 단계
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'settings' && (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6">분석 설정</h2>

            <div className="space-y-6">
              <div className="bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-slate-900 mb-2">선택된 해설</h3>
                <p className="text-slate-600">
                  {selectedExplanation?.ocr_results?.exams?.school_name} - {selectedExplanation?.ocr_results?.exams?.grade} - {selectedExplanation?.ocr_results?.exams?.exam_name}
                </p>
                <p className="text-sm text-slate-500">{selectedExplanation?.ocr_results?.questions?.length || 0}문항</p>
              </div>

              <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-xl p-4 border border-pink-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">Antigravity Gemini 2.5 Pro</div>
                    <div className="text-sm text-slate-500">최고 정확도 분석 모델</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-8 mt-8 border-t border-slate-100">
              <button
                onClick={() => setStep('sources')}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                이전 단계
              </button>

              <button
                onClick={handleSubmit}
                disabled={isUploading}
                className="flex items-center gap-2 bg-gradient-to-r from-yellow-300 to-yellow-400 text-white px-8 py-3 rounded-xl font-semibold hover:from-pink-400 hover:to-rose-500 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-yellow-500/25 disabled:shadow-none"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    분석 중...
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
        )}
      </main>
    </div>
  );
}

function StepIndicator({ step, label, active, completed }: { step: number; label: string; active: boolean; completed: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${
          active
            ? 'bg-gradient-to-br from-yellow-300 to-yellow-400 text-white shadow-lg shadow-yellow-500/25'
            : completed
            ? 'bg-green-500 text-white'
            : 'bg-slate-200 text-slate-500'
        }`}
      >
        {completed ? <CheckCircle2 className="w-5 h-5" /> : step}
      </div>
      <span className={`text-sm ${active ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
        {label}
      </span>
    </div>
  );
}

function InputField({
  label,
  required = false,
  type = 'text',
  value,
  onChange,
  placeholder,
}: {
  label: string;
  required?: boolean;
  type?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-pink-500 focus:border-transparent outline-none text-slate-900 bg-white"
      />
    </div>
  );
}

function DropzoneSection({
  title,
  description,
  icon,
  dropzone,
  files,
  onRemove,
  maxFiles,
  gradient,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  dropzone: ReturnType<typeof useDropzone>;
  files: File[];
  onRemove: (index: number) => void;
  maxFiles: number;
  gradient: string;
}) {
  const { getRootProps, getInputProps, isDragActive } = dropzone;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white`}>
          {icon}
        </div>
        <div>
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>

      {files.length < maxFiles && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-pink-500 bg-pink-50'
              : 'border-slate-200 hover:border-pink-300 hover:bg-slate-50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">
            {isDragActive ? '여기에 놓으세요' : '클릭하거나 드래그하세요'}
          </p>
          <p className="text-sm text-slate-400 mt-1">PDF 파일만 가능</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-pink-600" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={() => onRemove(index)}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
