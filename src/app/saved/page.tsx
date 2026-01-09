'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Database,
  Loader2,
  FileText,
  Calendar,
  ChevronRight,
  Trash2,
  Play,
} from 'lucide-react';

interface SavedReport {
  id: string;
  school_name: string;
  grade: string;
  exam_name: string;
  status: string;
  created_at: string;
  question_count: number;
}

export default function SavedMatchesPage() {
  const router = useRouter();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/saved-matches');
      const result = await response.json();
      if (result.success) {
        setReports(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('이 매칭 데이터를 삭제하시겠습니까?')) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/analyze/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_report' }),
      });
      const result = await response.json();
      if (result.success) {
        setReports((prev) => prev.filter((r) => r.id !== id));
      } else {
        alert(result.error || '삭제 실패');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류 발생');
    } finally {
      setDeletingId(null);
    }
  };

  const handleStartAnalysis = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/match/${id}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusLabels: Record<string, { label: string; color: string }> = {
    saved: { label: '저장됨', color: 'bg-blue-100 text-blue-700' },
    matching_review: { label: '매칭 검토 대기', color: 'bg-yellow-100 text-yellow-700' },
    review: { label: '검토중', color: 'bg-amber-100 text-amber-700' },
    approved: { label: '승인됨', color: 'bg-green-100 text-green-700' },
    published: { label: '게시됨', color: 'bg-emerald-100 text-emerald-700' },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">저장된 매칭</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">저장된 원문 매칭 목록</h1>
          <p className="text-slate-500">저장된 매칭 데이터를 확인하고 편집하거나 분석을 시작할 수 있습니다.</p>
        </div>

        {isLoading ? (
          <div className="py-20 text-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-slate-500">불러오는 중...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-slate-200">
            <Database className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-900 mb-2">저장된 매칭이 없습니다</h2>
            <p className="text-slate-500 mb-6">원문 연계 분석에서 매칭 후 저장하면 여기에 표시됩니다.</p>
            <Link
              href="/upload"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              원문 분석 시작
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                onClick={() => {
                  if (report.status === 'published' || report.status === 'approved') {
                    router.push(`/report/${report.id}`);
                  } else {
                    router.push(`/saved/${report.id}`);
                  }
                }}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">{report.school_name || '학교명 없음'}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusLabels[report.status]?.color || 'bg-slate-100 text-slate-600'}`}>
                        {statusLabels[report.status]?.label || report.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <FileText className="w-4 h-4" />
                        {report.grade} · {report.exam_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Database className="w-4 h-4" />
                        {report.question_count}문항
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {formatDate(report.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleStartAnalysis(report.id, e)}
                      className="flex items-center gap-1 px-3 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 transition-colors"
                    >
                      <Play className="w-4 h-4" />
                      분석
                    </button>
                    <button
                      onClick={(e) => handleDelete(report.id, e)}
                      disabled={deletingId === report.id}
                      className="flex items-center gap-1 px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      {deletingId === report.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
