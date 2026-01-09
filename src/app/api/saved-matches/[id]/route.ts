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

  try {
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('id, school_name, grade, exam_name, status, created_at, metadata')
      .eq('id', id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ success: false, error: 'Report not found' }, { status: 404 });
    }

    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('question_number, question_text, source_type, source_text, source_confidence, analysis')
      .eq('report_id', id)
      .order('question_number');

    if (questionsError) {
      return NextResponse.json({ success: false, error: questionsError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        report,
        questions: questions || [],
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
