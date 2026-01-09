import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    const { data: reports, error } = await supabase
      .from('reports')
      .select('id, school_name, grade, exam_name, status, created_at, metadata')
      .in('status', ['saved', 'matching_review', 'review', 'approved', 'published'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to fetch saved reports:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const reportsWithCount = await Promise.all(
      (reports || []).map(async (report) => {
        const { count } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('report_id', report.id);

        return {
          ...report,
          question_count: count || 0,
        };
      })
    );

    return NextResponse.json({ success: true, data: reportsWithCount });
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
