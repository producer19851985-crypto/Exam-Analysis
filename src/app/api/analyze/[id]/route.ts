import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runMatchingAnalysis, runDetailedAnalysis, MatchResult, ConfirmedMatch, DetailedAnalysis, ExtractedSource } from '@/lib/analyzer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AnalysisCache {
  status: string;
  step: string;
  progress: number;
  matches?: MatchResult[];
  sources?: Array<{ name: string; texts: ExtractedSource[] }>;
  analysis?: DetailedAnalysis[];
  error?: string;
}

const progressCache = new Map<string, AnalysisCache>();

function log(msg: string, data?: unknown) {
  console.log(`[API] ${msg}`, data ? JSON.stringify(data).substring(0, 200) : '');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cached = progressCache.get(id);
  if (cached && (cached.status === 'matching' || cached.status === 'analyzing')) {
    return NextResponse.json({ success: true, data: cached });
  }

  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !report) {
    if (cached) {
      return NextResponse.json({ success: true, data: cached });
    }
    return NextResponse.json({ success: false, error: '분석을 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('report_id', id)
    .order('question_number');

  let matches: MatchResult[] | undefined;
  let analysis: DetailedAnalysis[] | undefined;

  if (questions && questions.length > 0) {
    if (report.status === 'matching_review') {
      matches = questions.map(q => ({
        questionNumber: q.question_number,
        questionText: q.question_text,
        sourceType: q.source_type || 'external',
        sourceName: q.analysis?.source_name || '외부지문',
        sourceNumber: q.source_question_number,
        sourceText: q.source_text || '',
        confidence: q.source_confidence || 0,
        reasoning: q.analysis?.reasoning || '',
      }));
    } else if (['review', 'approved', 'published', 'rejected'].includes(report.status)) {
      analysis = questions.map(q => ({
        questionNumber: q.question_number,
        sourceType: q.source_type || 'external',
        sourceName: q.analysis?.source_name || '외부지문',
        questionType: q.question_type || '기타',
        difficulty: q.difficulty || 'medium',
        sentenceComparisons: q.analysis?.sentence_comparisons || [],
        vocabularyChanges: q.analysis?.vocabulary_changes || [],
        grammarPoints: q.analysis?.grammar_points || [],
        transformationSummary: q.analysis?.transformation_summary || '',
        teacherIntent: q.analysis?.teacher_intent || '',
        answerRationale: q.analysis?.answer_rationale || '',
        studyTips: q.analysis?.study_tips || [],
      }));
    }
  }

  const responseData = {
    status: report.status,
    step: report.status === 'published' ? '게시됨' : '대기중',
    progress: 100,
    matches,
    analysis,
    sources: cached?.sources,
    rejectionFeedback: report.error_message,
  };

  return NextResponse.json({ success: true, data: responseData });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  log(`POST ${id}, action: ${action}`);

  try {
    switch (action) {
      case 'start_matching': {
        const { examBase64, sources: sourcePdfs, metadata } = body;
        
        if (!examBase64) {
          return NextResponse.json({ success: false, error: '기출문제 PDF가 필요합니다.' }, { status: 400 });
        }

        const { error: insertError } = await supabase
          .from('reports')
          .upsert({
            id,
            school_name: metadata?.school_name || '미지정',
            grade: metadata?.grade || '고1',
            exam_name: metadata?.exam_name || '시험',
            student_password: metadata?.student_password || '1234',
            edit_password: metadata?.edit_password || 'admin',
            vocabulary_level: metadata?.vocabulary_level || 'teps_850',
            status: 'matching',
          });

        if (insertError) {
          log('Report insert error', insertError);
        }

        progressCache.set(id, { status: 'matching', step: 'PDF 분석', progress: 0 });

        runMatchingAnalysis(examBase64, sourcePdfs || [], (step, progress) => {
          const current = progressCache.get(id);
          if (current) progressCache.set(id, { ...current, step, progress });
        })
          .then(async ({ matches, sources }) => {
            for (const match of matches) {
              await supabase.from('questions').upsert({
                report_id: id,
                question_number: match.questionNumber,
                question_text: match.questionText,
                source_type: match.sourceType,
                source_confidence: match.confidence,
                source_question_number: match.sourceNumber,
                source_text: match.sourceText,
                analysis: {
                  source_name: match.sourceName,
                  reasoning: match.reasoning,
                },
              }, { onConflict: 'report_id,question_number' });
            }

            await supabase
              .from('reports')
              .update({ status: 'matching_review' })
              .eq('id', id);

            progressCache.set(id, {
              status: 'matching_review',
              step: '매칭 검토 대기',
              progress: 100,
              matches,
              sources,
            });
            log(`매칭 완료: ${matches.length}개`);
          })
          .catch(async (error) => {
            await supabase
              .from('reports')
              .update({ status: 'error', error_message: error.message })
              .eq('id', id);

            progressCache.set(id, {
              status: 'matching',
              step: '오류',
              progress: 0,
              error: error.message,
            });
          });

        return NextResponse.json({ success: true, message: '매칭 분석 시작' });
      }

      case 'confirm_matches': {
        const { confirmedMatches } = body;

        const { data: report } = await supabase
          .from('reports')
          .select('vocabulary_level')
          .eq('id', id)
          .single();

        const vocabularyLevel = report?.vocabulary_level || 'teps_850';

        await supabase
          .from('reports')
          .update({ status: 'analyzing' })
          .eq('id', id);

        for (const match of confirmedMatches) {
          await supabase
            .from('questions')
            .update({
              source_type: match.sourceType,
              source_text: match.sourceText,
              analysis: {
                source_name: match.sourceName,
              },
            })
            .eq('report_id', id)
            .eq('question_number', match.questionNumber);
        }

        progressCache.set(id, { status: 'analyzing', step: '상세 분석', progress: 0 });

        runDetailedAnalysis(confirmedMatches, vocabularyLevel || 'teps_850', (step, progress) => {
          const curr = progressCache.get(id);
          if (curr) progressCache.set(id, { ...curr, step, progress });
        })
          .then(async (analysis) => {
            for (const item of analysis) {
              await supabase
                .from('questions')
                .update({
                  question_type: item.questionType,
                  difficulty: item.difficulty,
                  analysis: {
                    source_name: item.sourceName,
                    sentence_comparisons: item.sentenceComparisons,
                    vocabulary_changes: item.vocabularyChanges,
                    grammar_points: item.grammarPoints,
                    transformation_summary: item.transformationSummary,
                    teacher_intent: item.teacherIntent,
                    answer_rationale: item.answerRationale,
                    study_tips: item.studyTips,
                  },
                })
                .eq('report_id', id)
                .eq('question_number', item.questionNumber);
            }

            await supabase
              .from('reports')
              .update({ status: 'review' })
              .eq('id', id);

            progressCache.set(id, {
              status: 'review',
              step: '검토 대기',
              progress: 100,
              analysis,
            });
            log(`상세 분석 완료: ${analysis.length}개`);
          })
          .catch(async (error) => {
            await supabase
              .from('reports')
              .update({ status: 'error', error_message: error.message })
              .eq('id', id);

            progressCache.set(id, {
              status: 'analyzing',
              step: '오류',
              progress: 0,
              error: error.message,
            });
          });

        return NextResponse.json({ success: true, message: '상세 분석 시작' });
      }

      case 'approve': {
        await supabase
          .from('reports')
          .update({ status: 'approved' })
          .eq('id', id);

        return NextResponse.json({ success: true, message: '승인 완료' });
      }

      case 'publish': {
        await supabase
          .from('reports')
          .update({ status: 'published', completed_at: new Date().toISOString() })
          .eq('id', id);

        progressCache.delete(id);

        return NextResponse.json({ success: true, message: '게시 완료' });
      }

      case 'reject': {
        const { feedback } = body;
        
        await supabase
          .from('reports')
          .update({ status: 'rejected', error_message: feedback })
          .eq('id', id);

        return NextResponse.json({ success: true, message: '반려됨' });
      }

      case 'update_analysis': {
        const { analysis } = body;
        
        for (const item of analysis) {
          await supabase
            .from('questions')
            .update({
              difficulty: item.difficulty,
              analysis: {
                source_name: item.sourceName,
                sentence_comparisons: item.sentenceComparisons,
                vocabulary_changes: item.vocabularyChanges,
                grammar_points: item.grammarPoints,
                transformation_summary: item.transformationSummary,
                teacher_intent: item.teacherIntent,
                answer_rationale: item.answerRationale,
                study_tips: item.studyTips,
              },
            })
            .eq('report_id', id)
            .eq('question_number', item.questionNumber);
        }

        await supabase
          .from('reports')
          .update({ status: 'review', error_message: null })
          .eq('id', id);

        return NextResponse.json({ success: true, message: '수정 완료' });
      }

      default:
        return NextResponse.json({ success: false, error: '알 수 없는 액션' }, { status: 400 });
    }
  } catch (error) {
    log('API 오류', error);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
