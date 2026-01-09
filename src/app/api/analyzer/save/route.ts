import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { AnalyzerReport, OverviewData } from '@/types/analyzer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      explanation_id,
      school_name,
      grade,
      exam_name,
      student_password,
      edit_password,
      overview_data,
    } = body as {
      explanation_id: string;
      school_name: string;
      grade: string;
      exam_name: string;
      student_password: string;
      edit_password: string;
      overview_data: OverviewData;
    };

    if (!explanation_id || !overview_data) {
      return NextResponse.json(
        { success: false, error: '필수 데이터가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const reportId = uuidv4();
    const newReport: Partial<AnalyzerReport> = {
      id: reportId,
      explanation_id,
      school_name: school_name || '',
      grade: grade || '',
      exam_name: exam_name || '',
      student_password: student_password || '',
      edit_password: edit_password || '',
      overview_data,
      status: 'published',
      created_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from('analyzer_reports')
      .insert(newReport);

    if (insertError) {
      console.error('Insert error:', insertError);
      return NextResponse.json(
        { success: false, error: '리포트 저장에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        report_id: reportId,
      status: 'completed',
      },
    });
  } catch (error) {
    console.error('Analyzer save error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
