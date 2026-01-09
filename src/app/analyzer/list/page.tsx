'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Database, FileText, Sparkles, Trash2 } from 'lucide-react';

interface Report {
  id: string;
  school_name: string;
  grade: string;
  exam_name: string;
  status: string;
  created_at: string;
}

export default function ListPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/analyzer/list');
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

  const handleDelete = async (e: React.MouseEvent, reportId: string, schoolName: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm(`"${schoolName}" 분석 결과를 삭제하시겠습니까?`)) {
      return;
    }

    setDeletingId(reportId);
    try {
      const response = await fetch(`/api/analyzer/${reportId}`, {
        method: 'DELETE',
      });
      const result = await response.json();
      if (result.success) {
        setReports(reports.filter(r => r.id !== reportId));
      } else {
        alert('삭제에 실패했습니다.');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}.${m}.${d} ${h}:${min}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/select" className="text-slate-400 hover:text-slate-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-rose-600 rounded-xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">저장된 어휘 목록</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center text-white">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">저장된 분석 결과</h2>
              <p className="text-sm text-slate-500">클릭하여 상세 내용을 확인하세요</p>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="w-8 h-8 text-pink-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-500">목록 불러오는 중...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="py-12 text-center">
              <Database className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500">저장된 어휘 분석이 없습니다.</p>
              <Link
                href="/select"
                className="inline-block mt-4 text-pink-600 hover:text-pink-700 font-medium"
              >
                새 분석 시작하기 →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="relative group"
                >
                  <Link
                    href={`/analyzer/${report.id}`}
                    className="block p-4 border border-slate-200 rounded-xl hover:border-pink-300 hover:bg-pink-50/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-pink-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">{report.school_name}</h3>
                          <p className="text-sm text-slate-500">
                            {report.grade} · {report.exam_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-sm text-slate-400">{formatDate(report.created_at)}</span>
                          <div className="mt-1">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                report.status === 'completed'
                                  ? 'bg-green-100 text-green-700'
                                  : report.status === 'published'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-amber-100 text-amber-700'
                              }`}
                            >
                              {report.status === 'completed'
                                ? '완료'
                                : report.status === 'published'
                                ? '게시됨'
                                : '처리중'}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleDelete(e, report.id, report.school_name)}
                          disabled={deletingId === report.id}
                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                        >
                          {deletingId === report.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
