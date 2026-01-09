import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET: 캐시된 OCR 결과 조회 (pdf_hash로)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pdfHash = searchParams.get('hash');

  if (!pdfHash) {
    return NextResponse.json({ success: false, error: 'hash parameter required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('source_ocr_cache')
      .select('*')
      .eq('pdf_hash', pdfHash)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      throw error;
    }

    if (data) {
      console.log(`[OCR Cache] 캐시 히트: ${data.file_name} (${pdfHash})`);
      return NextResponse.json({ success: true, cached: true, data });
    }

    return NextResponse.json({ success: true, cached: false, data: null });
  } catch (error) {
    console.error('[OCR Cache] 조회 오류:', error);
    return NextResponse.json({ success: false, error: 'Failed to query cache' }, { status: 500 });
  }
}

// POST: OCR 결과 캐시에 저장
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pdfHash, fileName, sourceType, ocrResult } = body;

    if (!pdfHash || !fileName || !sourceType || !ocrResult) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: pdfHash, fileName, sourceType, ocrResult' },
        { status: 400 }
      );
    }

    // upsert: 이미 있으면 업데이트, 없으면 삽입
    const { data, error } = await supabase
      .from('source_ocr_cache')
      .upsert(
        {
          pdf_hash: pdfHash,
          file_name: fileName,
          source_type: sourceType,
          ocr_result: ocrResult,
        },
        { onConflict: 'pdf_hash' }
      )
      .select()
      .single();

    if (error) {
      throw error;
    }

    console.log(`[OCR Cache] 캐시 저장: ${fileName} (${pdfHash})`);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('[OCR Cache] 저장 오류:', error);
    return NextResponse.json({ success: false, error: 'Failed to save cache' }, { status: 500 });
  }
}

// DELETE: 캐시 삭제
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pdfHash = searchParams.get('hash');

  if (!pdfHash) {
    return NextResponse.json({ success: false, error: 'hash parameter required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('source_ocr_cache')
      .delete()
      .eq('pdf_hash', pdfHash);

    if (error) {
      throw error;
    }

    console.log(`[OCR Cache] 캐시 삭제: ${pdfHash}`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[OCR Cache] 삭제 오류:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete cache' }, { status: 500 });
  }
}
