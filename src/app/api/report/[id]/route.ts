import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !report) {
    return NextResponse.json({ success: false, error: '리포트를 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: questions } = await supabase
    .from('questions')
    .select('*')
    .eq('report_id', id)
    .order('question_number');

  // analyzer_reports에서 overview_data 가져오기 (school_name + exam_name으로 매칭)
  let analyzerReport = null;

  // 먼저 같은 ID로 시도
  const { data: reportById } = await supabase
    .from('analyzer_reports')
    .select('overview_data')
    .eq('id', id)
    .single();

  if (reportById) {
    analyzerReport = reportById;
  } else {
    // school_name + exam_name으로 매칭 시도
    const { data: reportByName } = await supabase
      .from('analyzer_reports')
      .select('overview_data')
      .eq('school_name', report.school_name)
      .eq('exam_name', report.exam_name)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (reportByName) {
      analyzerReport = reportByName;
    }
  }

  const formattedQuestions = (questions || []).map(q => ({
    questionNumber: q.question_number,
    questionText: q.question_text || '',
    sourceText: q.source_text || '',
    sourceType: q.source_type || 'external',
    sourceName: q.analysis?.source_name || '외부지문',
    confidence: q.source_confidence || 100,
    questionType: q.question_type || '기타',
    difficulty: q.difficulty || 'medium',
    sentenceComparisons: (q.analysis?.sentence_comparisons || []).map((sc: any) => ({
      originalSentence: sc.original || '',
      transformedSentence: sc.transformed || '',
      changeType: sc.change_type || '',
      explanation: sc.explanation || '',
    })),
    vocabularyChanges: q.analysis?.vocabulary_changes || [],
    grammarChoices: q.analysis?.grammar_points || [],
    wrongAnswerAnalysis: q.analysis?.wrong_answer_analysis || [],
    transformationSummary: q.analysis?.transformation_summary || '',
    teacherIntent: q.analysis?.teacher_intent || '',
    answerRationale: q.analysis?.answer_rationale || '',
    studyRecommendations: q.analysis?.study_tips || [],
    teacherComment: q.teacher_comment || '',
  }));

  const summary = {
    total: formattedQuestions.length,
    direct: formattedQuestions.filter((q: any) => q.sourceType === 'direct').length,
    indirect: formattedQuestions.filter((q: any) => q.sourceType === 'indirect').length,
    external: formattedQuestions.filter((q: any) => q.sourceType === 'external').length,
    overallDifficulty: formattedQuestions.filter((q: any) => q.difficulty === 'high').length > formattedQuestions.length / 2 ? 'high' : 'medium',
  };

  return NextResponse.json({
    success: true,
    data: {
      metadata: {
        school_name: report.school_name,
        grade: report.grade,
        exam_name: report.exam_name,
        student_password: report.student_password,
        edit_password: report.edit_password,
        vocabulary_level: report.vocabulary_level,
        created_at: report.created_at,
        status: report.status,
      },
      questions: formattedQuestions,
      summary,
      overview_data: analyzerReport?.overview_data || null,
    },
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  if (action === 'save_comment') {
    const { questionNumber, comment } = body;
    
    await supabase
      .from('questions')
      .update({ teacher_comment: comment })
      .eq('report_id', id)
      .eq('question_number', questionNumber);

    return NextResponse.json({ success: true });
  }

  if (action === 'update_question') {
    const { questionNumber, updates } = body;
    
    const { data: existing } = await supabase
      .from('questions')
      .select('analysis')
      .eq('report_id', id)
      .eq('question_number', questionNumber)
      .single();

    const newAnalysis = {
      ...(existing?.analysis || {}),
      source_name: updates.sourceName,
      vocabulary_changes: updates.vocabularyChanges,
    };

    await supabase
      .from('questions')
      .update({
        source_type: updates.sourceType,
        difficulty: updates.difficulty,
        analysis: newAnalysis,
      })
      .eq('report_id', id)
      .eq('question_number', questionNumber);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ success: false, error: '알 수 없는 액션' }, { status: 400 });
}
