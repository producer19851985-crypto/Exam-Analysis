import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: reports, error } = await supabase
      .from('analyzer_reports')
      .select('id, school_name, grade, exam_name, status, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json(
        { success: false, error: '목록을 불러올 수 없습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: reports || [] });
  } catch (error) {
    console.error('List API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
