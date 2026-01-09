import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateOverviewData } from '@/lib/overview-generator';
import { generateVocabDetails } from '@/lib/gemini';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { explanation_id } = body;

    if (!explanation_id) {
      return NextResponse.json(
        { success: false, error: 'explanation_id가 필요합니다.' },
        { status: 400 }
      );
    }

    const { data: explanation, error: fetchError } = await supabase
      .from('explanations')
      .select(`
        id,
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
      .eq('id', explanation_id)
      .single();

    if (fetchError || !explanation) {
      return NextResponse.json(
        { success: false, error: '해설을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const ocrResult = explanation.ocr_results as unknown as {
      id: string;
      questions: Array<{
        number?: number;
        text?: string;
        type?: string;
        answer?: string;
      }>;
      exams: { school_name: string; grade: string; exam_name: string };
    } | null;

    const examInfo = ocrResult?.exams || { school_name: '', grade: '', exam_name: '' };
    const ocrQuestions = ocrResult?.questions || [];
    const questions = (explanation.explanations || []) as Array<{
      questionNumber: number;
      questionType: string;
      difficulty: 'high' | 'medium' | 'low';
      keyVocabulary?: Array<{ word: string; meaning: string; tepsLevel?: number }>;
    }>;

    const overviewData = generateOverviewData(questions, ocrQuestions);

    if (overviewData.vocabList.length > 0) {
      const words = overviewData.vocabList.map(v => v.word);
      const vocabDetails = await generateVocabDetails(words);
      
      const detailsMap = new Map(vocabDetails.map(d => [d.word.toLowerCase(), d]));
      overviewData.vocabList = overviewData.vocabList.map(v => {
        const detail = detailsMap.get(v.word.toLowerCase());
        return {
          ...v,
          meaning: detail?.meaning || '',
          pronunciation: detail?.pronunciation || '',
          etymology: detail?.etymology || '',
        };
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        preview: true,
        explanation_id,
        school_name: examInfo.school_name,
        grade: examInfo.grade,
        exam_name: examInfo.exam_name,
        overview_data: overviewData,
        explanation_questions: explanation.explanations || [],
        ocr_questions: ocrQuestions,
      },
    });
  } catch (error) {
    console.error('Analyzer API error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
