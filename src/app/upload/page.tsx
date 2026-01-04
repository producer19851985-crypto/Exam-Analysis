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
      const formData = new FormData();
      formData.append('exam', files.exam);
      files.mock.forEach((f) => formData.append('mock', f));
      files.textbook.forEach((f) => formData.append('textbook', f));
      formData.append('settings', JSON.stringify(settings));

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/analyze/${data.data.report_id}`);
      } else {
        alert(data.error || '업로드에 실패했습니다.');
      }
    } catch {
      alert('업로드 중 오류가 발생했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Upload className="w-6 h-6 text-blue-600" />
            <span className="text-lg font-semibold text-slate-900">새 분석 시작</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center justify-center gap-4 mb-10">
          <StepIndicator
            step={1}
            label="PDF 업로드"
            active={step === 'files'}
            completed={step === 'settings'}
          />
          <div className="w-16 h-0.5 bg-slate-200" />
          <StepIndicator step={2} label="설정" active={step === 'settings'} completed={false} />
        </div>

        {step === 'files' && (
          <div className="space-y-8">
            <DropzoneSection
              title="기출문제 PDF"
              description="내신 기출문제 스캔본 (필수)"
              icon={<FileText className="w-6 h-6" />}
              required
              dropzone={examDropzone}
              files={files.exam ? [files.exam] : []}
              onRemove={() => removeFile('exam')}
              maxFiles={1}
            />

            <DropzoneSection
              title="모의고사 PDF"
              description="시험 범위에 해당하는 모의고사 (최대 2개)"
              icon={<GraduationCap className="w-6 h-6" />}
              dropzone={mockDropzone}
              files={files.mock}
              onRemove={(i) => removeFile('mock', i)}
              maxFiles={2}
            />

            <DropzoneSection
              title="교과서 PDF"
              description="시험 범위에 해당하는 교과서 (최대 2개)"
              icon={<BookOpen className="w-6 h-6" />}
              dropzone={textbookDropzone}
              files={files.textbook}
              onRemove={(i) => removeFile('textbook', i)}
              maxFiles={2}
            />

            <div className="flex justify-end pt-4">
              <button
                onClick={() => setStep('settings')}
                disabled={!canProceed}
                className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                다음 단계
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {step === 'settings' && (
          <div className="bg-white rounded-2xl border p-8">
            <h2 className="text-xl font-semibold text-slate-900 mb-6">분석 설정</h2>

            <div className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    학교명 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={settings.school_name}
                    onChange={(e) => setSettings({ ...settings, school_name: e.target.value })}
                    placeholder="예: 백영고등학교"
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">학년</label>
                  <select
                    value={settings.grade}
                    onChange={(e) => setSettings({ ...settings, grade: e.target.value })}
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="고1">고1</option>
                    <option value="고2">고2</option>
                    <option value="고3">고3</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  시험명 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={settings.exam_name}
                  onChange={(e) => setSettings({ ...settings, exam_name: e.target.value })}
                  placeholder="예: 2024학년도 1학기 중간고사"
                  className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    학생용 비밀번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={settings.student_password}
                    onChange={(e) => setSettings({ ...settings, student_password: e.target.value })}
                    placeholder="학생들에게 공유할 비밀번호"
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    편집용 비밀번호 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={settings.edit_password}
                    onChange={(e) => setSettings({ ...settings, edit_password: e.target.value })}
                    placeholder="선생님 전용 편집 비밀번호"
                    className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  어휘 난이도 기준
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['teps_830', 'teps_850', 'teps_870'] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setSettings({ ...settings, vocabulary_level: level })}
                      className={`p-4 rounded-lg border-2 transition-colors ${
                        settings.vocabulary_level === level
                          ? 'border-blue-600 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-medium text-slate-900">
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

              <div className="bg-slate-50 rounded-lg p-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.use_pro_model}
                    onChange={(e) => setSettings({ ...settings, use_pro_model: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-medium text-slate-900">
                      Gemini 3 Pro 사용 (고품질 분석)
                    </div>
                    <div className="text-sm text-slate-500">
                      매칭 정확도가 높아집니다. 권장 옵션입니다.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-between pt-8 mt-8 border-t">
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
                className="flex items-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    업로드 중...
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

function StepIndicator({
  step,
  label,
  active,
  completed,
}: {
  step: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
          active
            ? 'bg-blue-600 text-white'
            : completed
            ? 'bg-green-500 text-white'
            : 'bg-slate-200 text-slate-500'
        }`}
      >
        {step}
      </div>
      <span className={`text-sm ${active ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>
        {label}
      </span>
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
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  required?: boolean;
  dropzone: ReturnType<typeof useDropzone>;
  files: File[];
  onRemove: (index?: number) => void;
  maxFiles: number;
}) {
  const { getRootProps, getInputProps, isDragActive } = dropzone;

  return (
    <div className="bg-white rounded-2xl border p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-blue-600">{icon}</div>
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
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <input {...getInputProps()} />
          <Upload className="w-8 h-8 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-600">
            {isDragActive ? '여기에 놓으세요' : '클릭하거나 파일을 드래그하세요'}
          </p>
          <p className="text-sm text-slate-400 mt-1">PDF 파일만 가능</p>
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-slate-50 rounded-lg px-4 py-3"
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
