'use client';

import Link from 'next/link';
import { FileText, Upload, BarChart3, Share2, Clock, Shield } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-8 h-8 text-blue-600" />
            <span className="text-xl font-bold text-slate-900">내신 기출 분석</span>
          </div>
          <Link
            href="/reports"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
          >
            이전 분석 보기
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-16">
        <section className="text-center mb-20">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">
            내신 기출문제 분석을
            <br />
            <span className="text-blue-600">15분 만에</span> 완료하세요
          </h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10">
            AI가 자동으로 기출문제와 원문을 비교 분석합니다.
            <br />
            직접/간접 연계 구분, 변형 패턴 분석, 고난도 어휘 추출까지.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-8 py-4 rounded-full text-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/25"
          >
            <Upload className="w-5 h-5" />
            새 분석 시작하기
          </Link>
        </section>

        <section className="grid md:grid-cols-3 gap-8 mb-20">
          <FeatureCard
            icon={<BarChart3 className="w-8 h-8 text-blue-600" />}
            title="정밀 매칭"
            description="Gemini 3 Pro가 기출문제와 원문을 정확하게 매칭합니다. 직접/간접 연계를 구분하고 확신도를 함께 제공합니다."
          />
          <FeatureCard
            icon={<FileText className="w-8 h-8 text-green-600" />}
            title="상세 변형 분석"
            description="어휘 변형, 문장 구조 변경, 문제 유형 전환까지. TEPS 830+ 고난도 어휘만 선별하여 정리합니다."
          />
          <FeatureCard
            icon={<Share2 className="w-8 h-8 text-purple-600" />}
            title="쉬운 공유"
            description="분석 완료 후 학생들에게 링크만 전달하세요. 비밀번호로 보호되어 안전합니다."
          />
        </section>

        <section className="bg-slate-100 rounded-3xl p-10 mb-20">
          <h2 className="text-2xl font-bold text-slate-900 mb-8 text-center">
            이렇게 동작합니다
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            <StepCard
              step={1}
              title="PDF 업로드"
              description="기출문제 + 모의고사/교과서 PDF를 업로드하세요."
            />
            <StepCard
              step={2}
              title="AI 분석"
              description="Gemini 3 Pro가 문제를 분석하고 원문을 매칭합니다."
            />
            <StepCard
              step={3}
              title="검토 및 수정"
              description="분석 결과를 확인하고 필요시 수정하세요."
            />
            <StepCard
              step={4}
              title="학생에게 공유"
              description="링크와 비밀번호를 학생들에게 전달하세요."
            />
          </div>
        </section>

        <section className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl border p-8">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-6 h-6 text-blue-600" />
              <h3 className="text-xl font-semibold text-slate-900">처리 시간</h3>
            </div>
            <p className="text-slate-600">
              평균 <span className="font-bold text-blue-600">15분</span> 내에 분석이 완료됩니다.
              병렬 처리로 30개 문항도 빠르게 분석합니다.
            </p>
          </div>
          <div className="bg-white rounded-2xl border p-8">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="w-6 h-6 text-green-600" />
              <h3 className="text-xl font-semibold text-slate-900">저작권 보호</h3>
            </div>
            <p className="text-slate-600">
              모든 리포트는 비밀번호로 보호됩니다.
              외부 검색엔진에 노출되지 않아 기출문제 저작권을 보호합니다.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t mt-20">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-slate-500 text-sm">
          Powered by Gemini 3 Pro • Built with Next.js
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-2xl border p-8 hover:shadow-lg transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-blue-600 text-white text-xl font-bold flex items-center justify-center mx-auto mb-4">
        {step}
      </div>
      <h4 className="font-semibold text-slate-900 mb-2">{title}</h4>
      <p className="text-sm text-slate-600">{description}</p>
    </div>
  );
}
