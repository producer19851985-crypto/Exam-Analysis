'use client';

import Link from 'next/link';
import { FileText, ArrowRight, Sparkles, BarChart3 } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div
            onClick={() => window.location.reload()}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-yellow-400 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-slate-900">Exam Analyzer</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-slate-900 mb-3">심층 분석</h1>
          <p className="text-slate-500">해설 데이터를 기반으로 시험 분석 리포트를 제공합니다.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Link
            href="/select"
            className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm hover:shadow-md hover:border-pink-300 transition-all group"
          >
            <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">어휘 분석</h2>
            <p className="text-slate-500 mb-4">
              시험지에서 출제 핵심 어휘를 추출하고 뜻/발음/어원을 제공합니다.
            </p>
            <div className="flex items-center gap-2 text-pink-600 font-medium">
              시작하기
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          <Link
            href="/upload"
            className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm hover:shadow-md hover:border-yellow-300 transition-all group"
          >
            <div className="w-14 h-14 bg-gradient-to-br from-yellow-300 to-yellow-400 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">원문 연계 분석</h2>
            <p className="text-slate-500 mb-4">
              기출문제와 원문(모의고사/교과서)을 비교하여 변형 패턴을 분석합니다.
            </p>
            <div className="flex items-center gap-2 text-yellow-600 font-medium">
              시작하기
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}
