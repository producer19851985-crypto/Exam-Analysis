import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('explanations')
      .select(`
        id,
        ocr_result_id,
        explanations,
        status,
        created_at,
        ocr_results (
          id,
          questions,
          exams (
            school_name,
            grade,
            exam_name
          )
        )
      `)
      .in('status', ['draft', 'published'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Explanations fetch error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('Explanations API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
