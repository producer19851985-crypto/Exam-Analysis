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

  const { data: report, error: reportError } = await supabase
    .from('analyzer_reports')
    .select('*')
    .eq('id', id)
    .single();

  if (reportError || !report) {
    return NextResponse.json(
      { success: false, error: '리포트를 찾을 수 없습니다.' },
      { status: 404 }
    );
  }

  const { data: explanation, error: explanationError } = await supabase
    .from('explanations')
    .select(`
      id,
      explanations,
      created_at,
      ocr_results (
        id,
        questions
      )
    `)
    .eq('id', report.explanation_id)
    .single();

  if (explanationError) {
    console.error('Explanation fetch error:', explanationError);
  }

  const ocrResult = explanation?.ocr_results as { id?: string; questions?: Array<{ number: number; text: string; answer?: string }> } | null;

  return NextResponse.json({
    success: true,
    data: {
      report: {
        id: report.id,
        explanation_id: report.explanation_id,
        school_name: report.school_name,
        grade: report.grade,
        exam_name: report.exam_name,
        student_password: report.student_password,
        edit_password: report.edit_password,
        overview_data: report.overview_data,
        status: report.status,
        error_message: report.error_message,
        created_at: report.created_at,
        completed_at: report.completed_at,
      },
      explanation: explanation
        ? {
            id: explanation.id,
            questions: explanation.explanations || [],
            created_at: explanation.created_at,
          }
        : null,
      ocrQuestions: ocrResult?.questions || [],
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { status, overview_data } = body;

  const updateData: Record<string, unknown> = {};

  if (status) {
    if (!['processing', 'completed', 'published', 'error'].includes(status)) {
      return NextResponse.json(
        { success: false, error: '유효하지 않은 상태값입니다.' },
        { status: 400 }
      );
    }
    updateData.status = status;
  }

  if (overview_data) {
    updateData.overview_data = overview_data;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { success: false, error: '업데이트할 데이터가 없습니다.' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('analyzer_reports')
    .update(updateData)
    .eq('id', id);

  if (error) {
    console.error('Update error:', error);
    return NextResponse.json(
      { success: false, error: '업데이트에 실패했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const { error } = await supabase
    .from('analyzer_reports')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Delete error:', error);
    return NextResponse.json(
      { success: false, error: '삭제에 실패했습니다.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
