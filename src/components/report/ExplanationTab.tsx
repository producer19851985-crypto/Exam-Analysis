'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface QuestionExplanation {
  questionNumber: number;
  questionType: string;
  difficulty: 'high' | 'medium' | 'low';
  answerRationale: string;
  wrongAnswerAnalysis: Array<{ choice: string; reason: string }>;
  grammarPoints?: Array<{
    choiceNumber: number | string;
    content: string;
    grammaticalFocus: string;
    isCorrect: boolean;
    explanation: string;
  }>;
  keyVocabulary: Array<{ word: string; meaning: string; example?: string }>;
  studyTips: string[];
}

interface OcrQuestion {
  number: number;
  text: string;
  answer?: string;
}

interface ExplanationTabProps {
  questions: QuestionExplanation[];
  ocrQuestions: OcrQuestion[];
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<u class="font-medium">$1</u>')
    .replace(/\n/g, '<br />');
}

function MarkdownText({ text, className = '' }: { text: string; className?: string }) {
  return (
    <span 
      className={className}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} 
    />
  );
}

export function ExplanationTab({ questions, ocrQuestions }: ExplanationTabProps) {
  const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(
    new Set(questions.map((q) => q.questionNumber))
  );

  const toggleQuestion = (num: number) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(num)) {
        next.delete(num);
      } else {
        next.add(num);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedQuestions(new Set(questions.map((q) => q.questionNumber)));
  };

  const collapseAll = () => {
    setExpandedQuestions(new Set());
  };

  const difficultyLabels: Record<string, string> = { high: '상', medium: '중', low: '하' };
  const difficultyColors: Record<string, string> = {
    high: 'bg-red-100 text-red-700',
    medium: 'bg-amber-100 text-amber-700',
    low: 'bg-green-100 text-green-700',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2 mb-4">
        <button onClick={expandAll} className="text-sm text-green-600 hover:text-green-700">
          모두 펼치기
        </button>
        <span className="text-slate-300">|</span>
        <button onClick={collapseAll} className="text-sm text-green-600 hover:text-green-700">
          모두 접기
        </button>
      </div>

      {questions.map((exp) => {
        const ocrQuestion = ocrQuestions.find(q => q.number === exp.questionNumber);
        
        return (
          <div key={exp.questionNumber} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div
              onClick={() => toggleQuestion(exp.questionNumber)}
              className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-slate-900">#{exp.questionNumber}</span>
                <span className="px-2.5 py-1 bg-purple-100 text-purple-700 rounded-lg text-xs font-medium">
                  {exp.questionType}
                </span>
                {ocrQuestion?.answer && (
                  <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium">
                    정답: {ocrQuestion.answer}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-lg text-xs font-medium ${difficultyColors[exp.difficulty]}`}>
                  {difficultyLabels[exp.difficulty]}
                </span>
                {expandedQuestions.has(exp.questionNumber) ? (
                  <ChevronDown className="w-5 h-5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-slate-400" />
                )}
              </div>
            </div>

            {expandedQuestions.has(exp.questionNumber) && (
              <div className="px-6 pb-6 border-t border-slate-100 space-y-4 pt-4">
                {ocrQuestion?.text && (
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-sm text-slate-500 font-medium mb-2">문제</p>
                    <MarkdownText text={ocrQuestion.text} className="text-sm text-slate-800 leading-relaxed block text-justify" />
                  </div>
                )}

                <div className="p-4 rounded-xl bg-green-50">
                  <p className="text-sm font-medium mb-1 text-green-600">정답 근거</p>
                  <MarkdownText text={exp.answerRationale} className="text-slate-800 block" />
                </div>

                {exp.wrongAnswerAnalysis.length > 0 && (
                  <div className="p-4 rounded-xl bg-red-50">
                    <p className="text-sm font-medium mb-3 text-red-600">오답 분석</p>
                    <div className="space-y-3">
                      {exp.wrongAnswerAnalysis.map((wa, i) => (
                        <div key={i} className="rounded-lg p-3 bg-white/60">
                          <p className="text-sm font-semibold mb-1 text-red-700">{wa.choice}</p>
                          <MarkdownText text={wa.reason} className="text-sm text-slate-700 leading-relaxed block" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {exp.grammarPoints && exp.grammarPoints.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-2">어법 분석</p>
                    <div className="space-y-2">
                      {exp.grammarPoints.map((gp, i) => (
                        <div key={i} className={`p-3 rounded-xl border ${gp.isCorrect ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${gp.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {gp.choiceNumber}
                            </span>
                            <span className="font-medium text-slate-900">{gp.content}</span>
                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">{gp.grammaticalFocus}</span>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${gp.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {gp.isCorrect ? '어법상 맞는 문장' : '어법상 틀린 문장'}
                            </span>
                          </div>
                          <MarkdownText text={gp.explanation} className="text-sm text-slate-600 ml-8 block" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {exp.keyVocabulary.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-slate-500 mb-2">핵심 어휘</p>
                    <div className="flex flex-wrap gap-2">
                      {exp.keyVocabulary.map((v, i) => (
                        <span key={i} className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                          <span className="font-semibold text-blue-700">{v.word}</span>
                          <span className="text-slate-500 ml-1">- {v.meaning}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {exp.studyTips.length > 0 && (
                  <div className="p-4 rounded-xl bg-teal-50">
                    <p className="text-sm font-medium mb-2 text-teal-600">학습 팁</p>
                    <ul className="space-y-1">
                      {exp.studyTips.map((tip, i) => (
                        <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                          <span className="w-5 h-5 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs flex-shrink-0">{i + 1}</span>
                          <MarkdownText text={tip} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
