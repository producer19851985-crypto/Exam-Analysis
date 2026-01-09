import { NextRequest, NextResponse } from 'next/server';
import { generateVocabDetails } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { words } = body as { words: string[] };

    if (!words || words.length === 0) {
      return NextResponse.json(
        { success: false, error: '단어 목록이 필요합니다.' },
        { status: 400 }
      );
    }

    const vocabDetails = await generateVocabDetails(words);

    return NextResponse.json({
      success: true,
      data: vocabDetails,
    });
  } catch (error) {
    console.error('Vocab details error:', error);
    return NextResponse.json(
      { success: false, error: '어휘 정보 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
