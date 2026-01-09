-- 원문 OCR 캐시 테이블
-- 모의고사/교과서 PDF의 OCR 결과를 저장하여 재사용
CREATE TABLE IF NOT EXISTS source_ocr_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pdf_hash VARCHAR(32) NOT NULL UNIQUE,  -- PDF 파일의 SHA256 해시 (앞 16자)
  file_name VARCHAR(255) NOT NULL,       -- 원본 파일명
  source_type VARCHAR(50) NOT NULL,      -- 'mock' (모의고사) 또는 'textbook' (교과서)
  ocr_result JSONB NOT NULL,             -- OCR 결과 (ExtractedSource[] 형태)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_source_ocr_cache_pdf_hash ON source_ocr_cache(pdf_hash);
CREATE INDEX IF NOT EXISTS idx_source_ocr_cache_source_type ON source_ocr_cache(source_type);

-- 업데이트 시간 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_source_ocr_cache_updated_at ON source_ocr_cache;
CREATE TRIGGER update_source_ocr_cache_updated_at
  BEFORE UPDATE ON source_ocr_cache
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
