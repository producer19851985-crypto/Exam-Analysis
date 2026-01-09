'use client';

import { useState } from 'react';
import { OverviewData, VocabWordInfo, PhraseInfo } from '@/types/analyzer';
import { TrendingUp, BookOpen, Target, FileText, X } from 'lucide-react';

interface OverviewTabProps {
  data: OverviewData;
}

export function OverviewTab({ data }: OverviewTabProps) {
  const [showVocabModal, setShowVocabModal] = useState(false);

  const difficultyLabels = { high: '상', medium: '중', low: '하' };
  const difficultyColors = {
    high: 'from-red-500 to-rose-600',
    medium: 'from-amber-500 to-orange-600',
    low: 'from-green-500 to-emerald-600',
  };

  const topTypes = data.typeDistribution.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Target className="w-5 h-5" />}
          label="총 문항"
          value={data.totalQuestions}
          subtext="문항"
          gradient="from-pink-500 to-rose-600"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5" />}
          label="평균 난이도"
          value={difficultyLabels[data.averageDifficulty]}
          subtext=""
          gradient={difficultyColors[data.averageDifficulty]}
        />
        <StatCard
          icon={<BookOpen className="w-5 h-5" />}
          label="출제 핵심 어휘"
          value={data.hardVocabCount}
          subtext="개"
          gradient="from-purple-500 to-violet-600"
          onClick={() => setShowVocabModal(true)}
          clickable
        />
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="주요 유형"
          value={topTypes[0]?.label.split(' ')[0] || '-'}
          subtext={`외 ${data.typeDistribution.length - 1}개`}
          gradient="from-blue-500 to-cyan-600"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">📝 문제 유형 분포</h3>
            <span className="text-sm text-slate-500">
              합계: {data.typeDistribution.reduce((sum, item) => sum + item.count, 0)}개
            </span>
          </div>
          <div className="space-y-3">
            {data.typeDistribution.map((item, index) => (
              <DistributionBar
                key={`${item.type}-${index}`}
                label={item.label}
                count={item.count}
                percentage={item.percentage}
                color="bg-pink-500"
              />
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-900">📚 어휘 난이도 분포</h3>
          </div>
          <div className="space-y-4">
            {data.vocabDistribution.filter(v => v.count > 0).map((item) => (
              <div key={item.level} className="flex items-center gap-4">
                <div className="text-2xl w-8">{item.emoji}</div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-slate-900">{item.label}</span>
                    <span className="text-slate-500">{item.count}개 ({item.percentage}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        item.level === 'extreme' ? 'bg-red-500' :
                        item.level === 'very_hard' ? 'bg-orange-500' :
                        item.level === 'hard' ? 'bg-blue-500' : 'bg-green-500'
                      }`} 
                      style={{ width: `${item.percentage}%` }} 
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {data.vocabDistribution.every(v => v.count === 0) && (
            <p className="text-slate-400 text-center py-4">어휘 데이터가 없습니다</p>
          )}
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-violet-50 rounded-2xl border border-purple-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-4">
          <h3 className="font-bold text-slate-900">📖 어휘 난이도 기준</h3>
          <span className="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full w-fit">
            CEFR 유럽공통언어표준 기준
          </span>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          CEFR(Common European Framework of Reference)은 유럽연합에서 개발한 언어 능력 평가 기준으로, 전 세계적으로 사용됩니다.
        </p>
        <div className="grid md:grid-cols-4 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-lg">📗</span>
            <div>
              <span className="font-medium text-slate-900">기본</span>
              <span className="text-slate-500 ml-1">(A1~B1)</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📘</span>
            <div>
              <span className="font-medium text-slate-900">내신 기본</span>
              <span className="text-slate-500 ml-1">(B2)</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📙</span>
            <div>
              <span className="font-medium text-slate-900">상위권 필수</span>
              <span className="text-slate-500 ml-1">(C1)</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">📕</span>
            <div>
              <span className="font-medium text-slate-900">최상위</span>
              <span className="text-slate-500 ml-1">(C2)</span>
            </div>
          </div>
        </div>
      </div>

      {showVocabModal && (
        <VocabModal 
          vocabList={data.vocabList}
          phraseList={data.phraseList || []}
          onClose={() => setShowVocabModal(false)} 
        />
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  subtext,
  gradient,
  onClick,
  clickable = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext: string;
  gradient: string;
  onClick?: () => void;
  clickable?: boolean;
}) {
  return (
    <div 
      className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm ${
        clickable ? 'cursor-pointer hover:shadow-md hover:border-purple-300 transition-all' : ''
      }`}
      onClick={onClick}
    >
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white mb-3`}>
        {icon}
      </div>
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
          {value}
        </span>
        {subtext && <span className="text-sm text-slate-400">{subtext}</span>}
      </div>
      {clickable && (
        <p className="text-xs text-purple-500 mt-2">클릭하여 목록 보기</p>
      )}
    </div>
  );
}

function DistributionBar({
  label,
  count,
  percentage,
  color,
}: {
  label: string;
  count: number;
  percentage: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-slate-700 truncate">{label}</span>
        <span className="text-slate-500 flex-shrink-0 ml-2">{count}개 ({percentage}%)</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function VocabModal({ 
  vocabList,
  phraseList,
  onClose 
}: { 
  vocabList: VocabWordInfo[];
  phraseList: PhraseInfo[];
  onClose: () => void;
}) {
  const wordCount = vocabList.filter(v => !v.isPhrase).length;
  const phraseCount = vocabList.filter(v => v.isPhrase).length;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-purple-500 to-violet-600">
          <div>
            <h2 className="font-bold text-lg text-white">📚 출제 핵심 어휘</h2>
            <p className="text-purple-100 text-sm">
              단어 {wordCount}개{phraseCount > 0 && `, 숙어 ${phraseCount}개`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {vocabList.length > 0 ? (
            <VocabTable words={vocabList} />
          ) : (
            <p className="text-center text-slate-400 py-8">고난도 어휘가 없습니다</p>
          )}
        </div>

        <div className="px-6 py-4 border-t bg-slate-50">
          <p className="text-xs text-slate-500 text-center">
            💡 어휘 문제에서 밑줄/선택지로 출제된 단어 - 시험 대비 필수 암기
          </p>
        </div>
      </div>
    </div>
  );
}

function VocabTable({ words }: { words: VocabWordInfo[] }) {
  const hasMissingInfo = words.some(w => !w.meaning);

  return (
    <div className="space-y-3">
      {hasMissingInfo && (
        <div className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          ⚠️ 일부 단어의 상세 정보가 누락되었습니다. 사전에서 직접 확인해주세요.
        </div>
      )}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-5 py-3 text-sm font-semibold text-slate-700 w-1/4">단어/숙어</th>
              <th className="text-left px-5 py-3 text-sm font-semibold text-slate-700">품사 · 발음 · 뜻 · 어원</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {words.map((word, index) => (
              <tr key={index} className={`hover:bg-slate-50 ${word.isPhrase ? 'bg-violet-50/50' : ''}`}>
                <td className="px-5 py-4 align-middle">
                  <span className="font-bold text-slate-900 text-base">{word.word}</span>
                  {word.isPhrase && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-violet-200 text-violet-700">숙어</span>
                  )}
                </td>
                <td className="px-5 py-4 align-middle">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {!word.isPhrase && (
                        <>
                          <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700">{word.pos}</span>
                          {word.pronunciation ? (
                            <span className="text-slate-500 text-sm">{word.pronunciation}</span>
                          ) : (
                            <span className="text-slate-300 text-sm italic">발음 정보 없음</span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                            {word.cefr}
                          </span>
                        </>
                      )}
                    </div>
                    {word.meaning ? (
                      <p className="text-slate-800 font-medium">{word.meaning}</p>
                    ) : (
                      <p className="text-slate-400 italic text-sm">뜻 정보 없음 - 사전 확인 필요</p>
                    )}
                    {word.etymology && (
                      <p className="text-slate-500 text-sm">💡 {word.etymology}</p>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
