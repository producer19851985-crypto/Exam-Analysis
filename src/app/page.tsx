'use client';

import Link from 'next/link';
import { FileText, Upload, BarChart3, Share2, Clock, Shield, Sparkles, ArrowRight, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      
      <header className="relative border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">내신분석</span>
          </div>
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all border border-white/10"
          >
            <Upload className="w-4 h-4" />
            시작하기
          </Link>
        </div>
      </header>

      <main className="relative">
        <section className="max-w-6xl mx-auto px-6 py-24 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-full border border-blue-500/30 mb-8">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-blue-300">Antigravity Gemini 3 Pro 탑재</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            내신 기출 분석을
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              15분 만에
            </span>
          </h1>
          
          <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-12">
            AI가 기출문제와 원문을 자동 비교 분석합니다.
            <br />
            직접/간접 연계, 변형 패턴, 고난도 어휘까지 한번에.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/upload"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-4 rounded-2xl text-lg font-semibold hover:from-blue-500 hover:to-purple-500 transition-all shadow-2xl shadow-blue-500/25"
            >
              <Upload className="w-5 h-5" />
              분석 시작하기
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard
              icon={<BarChart3 className="w-6 h-6" />}
              title="정밀 매칭"
              description="기출문제와 원문을 AI가 자동 매칭. 직접/간접 연계를 구분하고 확신도를 제공합니다."
              gradient="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<Zap className="w-6 h-6" />}
              title="상세 변형 분석"
              description="문장 단위 비교, 어휘 패러프레이징, 문법 포인트까지. TEPS 830+ 어휘를 선별 추출합니다."
              gradient="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={<Share2 className="w-6 h-6" />}
              title="간편한 공유"
              description="분석 완료 후 링크만 전달하세요. 비밀번호 보호로 안전하게 학생들과 공유합니다."
              gradient="from-amber-500 to-orange-500"
            />
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 rounded-3xl border border-slate-700/50 p-10 backdrop-blur-xl">
            <h2 className="text-2xl font-bold text-white mb-10 text-center">
              이렇게 동작합니다
            </h2>
            <div className="grid md:grid-cols-4 gap-8">
              <StepCard step={1} title="PDF 업로드" description="기출 + 모의고사/교과서" />
              <StepCard step={2} title="AI 분석" description="자동 매칭 및 변형 분석" />
              <StepCard step={3} title="검토 및 수정" description="결과 확인, 필요시 편집" />
              <StepCard step={4} title="학생 공유" description="링크와 비밀번호 전달" />
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="grid md:grid-cols-2 gap-6">
            <InfoCard
              icon={<Clock className="w-6 h-6 text-blue-400" />}
              title="평균 15분"
              description="30개 문항도 빠르게 분석합니다. 병렬 처리로 시간을 단축합니다."
            />
            <InfoCard
              icon={<Shield className="w-6 h-6 text-green-400" />}
              title="저작권 보호"
              description="모든 리포트는 비밀번호로 보호됩니다. 검색엔진에 노출되지 않습니다."
            />
          </div>
        </section>
      </main>

      <footer className="relative border-t border-slate-700/50 mt-20">
        <div className="max-w-6xl mx-auto px-6 py-8 text-center text-slate-500 text-sm">
          Powered by Antigravity Gemini 3 Pro • Built with Next.js
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  gradient,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="group bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8 hover:border-slate-600 transition-all hover:-translate-y-1">
      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-6`}>
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-white mb-3">{title}</h3>
      <p className="text-slate-400 leading-relaxed">{description}</p>
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
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 text-white text-xl font-bold flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/25">
        {step}
      </div>
      <h4 className="font-semibold text-white mb-2">{title}</h4>
      <p className="text-sm text-slate-400">{description}</p>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-8">
      <div className="flex items-center gap-4 mb-4">
        {icon}
        <h3 className="text-xl font-semibold text-white">{title}</h3>
      </div>
      <p className="text-slate-400">{description}</p>
    </div>
  );
}
