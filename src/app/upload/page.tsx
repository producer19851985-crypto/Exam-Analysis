'use client';

import { useState, useCallback } from 'react';
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
} from 'lucide-react';

interface FileWithPreview extends File {
  preview?: string;
}

interface UploadedFiles {
  exam: FileWithPreview | null;
  mock: FileWithPreview[];
  textbook: FileWithPreview[];
}

type Step = 'files' | 'settings';

export default function UploadPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('files');
  const [isUploading, setIsUploading] = useState(false);
  const [files, setFiles] = useState<UploadedFiles>({
    exam: null,
    mock: [],
    textbook: [],
  });
  const [settings, setSettings] = useState({
    school_name: '',
    grade: '고1',
    exam_name: '',
    student_password: '',
    edit_password: '',
    vocabulary_level: 'teps_850' as 'teps_830' | 'teps_850' | 'teps_870',
    use_pro_model: true,
  });

  const onDropExam = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFiles((prev) => ({ ...prev, exam: acceptedFiles[0] }));
    }
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

  const examDropzone = useDropzone({
    onDrop: onDropExam,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

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

  const removeFile = (type: keyof UploadedFiles, index?: number) => {
    if (type === 'exam') {
      setFiles((prev) => ({ ...prev, exam: null }));
    } else if (typeof index === 'number') {
      setFiles((prev) => ({
        ...prev,
        [type]: prev[type].filter((_, i) => i !== index),
      }));
    }
  };

  const canProceed = files.exam !== null;

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

  const handleSubmit = async () => {
    if (!files.exam || !settings.school_name || !settings.exam_name) {
      alert('필수 항목을 입력해주세요.');
      return;
    }

    if (!settings.student_password || !settings.edit_password) {
      alert('비밀번호를 입력해주세요.');
      return;
    }

    setIsUploading(true);

    try {
      const reportId = crypto.randomUUID();

      const examBase64 = await fileToBase64(files.exam);

      const sources: Array<{ name: string; base64: string }> = [];
      
      for (let i = 0; i < files.mock.length; i++) {
        const base64 = await fileToBase64(files.mock[i]);
        sources.push({
          name: files.mock[i].name.replace('.pdf', ''),
          base64,
        });
      }

      for (let i = 0; i < files.textbook.length; i++) {
        const base64 = await fileToBase64(files.textbook[i]);
        sources.push({
          name: files.textbook[i].name.replace('.pdf', ''),
          base64,
        });
      }

      const response = await fetch(`/api/analyze/${reportId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_matching',
          examBase64,
          sources,
          vocabularyLevel: settings.vocabulary_level,
          metadata: {
            school_name: settings.school_name,
            grade: settings.grade,
            exam_name: settings.exam_name,
            student_password: settings.student_password,
            edit_password: settings.edit_password,
            vocabulary_level: settings.vocabulary_level,
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
      alert('업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Upload className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">새 분석</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-center gap-4 mb-10">
          <StepIndicator step={1} label="파일 업로드" active={step === 'files'} completed={step === 'settings'} />
          <div className="w-16 h-0.5 bg-slate-200" />
          <StepIndicator step={2} label="설정" active={step === 'settings'} completed={false} />
        </div>

        {step === 'files' && (
          <div className="space-y-6">
            <DropzoneSection
              title="기출문제 PDF"
              description="내신 기출문제 스캔본"
              icon={<FileText className="w-6 h-6" />}
              required
              dropzone={examDropzone}
              files={files.exam ? [files.exam] : []}
              onRemove={() => removeFile('exam')}
              maxFiles={1}
              gradient="from-blue-500 to-purple-500"
            />

            <DropzoneSection
              title="모의고사 PDF"
              description="시험 범위 모의고사 (최대 2개)"
              icon={<GraduationCap className="w-6 h-6" />}
              dropzone={mockDropzone}
              files={files.mock}
              onRemove={(i) => removeFile('mock', i)}
              maxFiles={2}
              gradient="from-amber-500 to-orange-500"
            />

            <DropzoneSection
              title="교과서 PDF"
              description="시험 범위 교과서 (최대 2개)"
              icon={<BookOpen className="w-6 h-6" />}
              dropzone={textbookDropzone}
              files={files.textbook}
              onRemove={(i) => removeFile('textbook', i)}
              maxFiles={2}
              gradient="from-green-500 to-teal-500"
            />

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setStep('settings')}
                disabled={!canProceed}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-500 hover:to-purple-500 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25 disabled:shadow-none"
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
              <div className="grid md:grid-cols-2 gap-6">
                <InputField
                  label="학교명"
                  required
                  value={settings.school_name}
                  onChange={(e) => setSettings({ ...settings, school_name: e.target.value })}
                  placeholder="예: 백영고등학교"
                />
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">학년</label>
                  <select
                    value={settings.grade}
                    onChange={(e) => setSettings({ ...settings, grade: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 bg-white"
                  >
                    <option value="고1">고1</option>
                    <option value="고2">고2</option>
                    <option value="고3">고3</option>
                  </select>
                </div>
              </div>

              <InputField
                label="시험명"
                required
                value={settings.exam_name}
                onChange={(e) => setSettings({ ...settings, exam_name: e.target.value })}
                placeholder="예: 2024학년도 1학기 중간고사"
              />

              <div className="grid md:grid-cols-2 gap-6">
                <InputField
                  label="학생용 비밀번호"
                  required
                  type="password"
                  value={settings.student_password}
                  onChange={(e) => setSettings({ ...settings, student_password: e.target.value })}
                  placeholder="학생 공유용"
                />
                <InputField
                  label="편집용 비밀번호"
                  required
                  type="password"
                  value={settings.edit_password}
                  onChange={(e) => setSettings({ ...settings, edit_password: e.target.value })}
                  placeholder="선생님 전용"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">어휘 난이도</label>
                <div className="grid grid-cols-3 gap-3">
                  {(['teps_830', 'teps_850', 'teps_870'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setSettings({ ...settings, vocabulary_level: level })}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        settings.vocabulary_level === level
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="font-semibold text-slate-900">
                        {level === 'teps_830' && 'TEPS 830+'}
                        {level === 'teps_850' && 'TEPS 850+'}
                        {level === 'teps_870' && 'TEPS 870+'}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {level === 'teps_830' && '고난도'}
                        {level === 'teps_850' && '최고난도 (권장)'}
                        {level === 'teps_870' && '극한난도'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">Antigravity Gemini 3 Pro</div>
                    <div className="text-sm text-slate-500">최고 정확도 분석 모델</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between pt-8 mt-8 border-t border-slate-100">
              <button
                onClick={() => setStep('files')}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                이전 단계
              </button>

              <button
                onClick={handleSubmit}
                disabled={isUploading || !settings.school_name || !settings.exam_name}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-xl font-semibold hover:from-blue-500 hover:to-purple-500 disabled:from-slate-300 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/25 disabled:shadow-none"
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
            ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/25'
            : completed
            ? 'bg-green-500 text-white'
            : 'bg-slate-200 text-slate-500'
        }`}
      >
        {step}
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
        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-slate-900 bg-white"
      />
    </div>
  );
}

function DropzoneSection({
  title,
  description,
  icon,
  required = false,
  dropzone,
  files,
  onRemove,
  maxFiles,
  gradient,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  required?: boolean;
  dropzone: ReturnType<typeof useDropzone>;
  files: File[];
  onRemove: (index?: number) => void;
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
          <h3 className="font-semibold text-slate-900">
            {title}
            {required && <span className="text-red-500 ml-1">*</span>}
          </h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>

      {files.length < maxFiles && (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
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
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={() => onRemove(maxFiles === 1 ? undefined : index)}
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
