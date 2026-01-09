-- 3개 툴 공유 DB 스키마
-- exam-ocr, exam-explanation, exam-analyzer

-- 1. 시험지 기본 정보 (공유)
CREATE TABLE IF NOT EXISTS exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_name TEXT NOT NULL,
    grade TEXT NOT NULL,
    exam_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. OCR 결과 (exam-ocr에서 생성, 다른 툴에서 참조)
CREATE TABLE IF NOT EXISTS ocr_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
    questions JSONB NOT NULL,
    answer_key TEXT,
    pdf_hash TEXT,
    pdf_url TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 해설지 (exam-explanation에서 생성)
CREATE TABLE IF NOT EXISTS explanations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ocr_result_id UUID REFERENCES ocr_results(id) ON DELETE CASCADE,
    explanations JSONB NOT NULL,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'published')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 변형분석 결과 (exam-analyzer에서 생성)
CREATE TABLE IF NOT EXISTS analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ocr_result_id UUID REFERENCES ocr_results(id) ON DELETE CASCADE,
    source_files JSONB,
    matches JSONB,
    detailed_analysis JSONB,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'matching', 'analyzing', 'review', 'published')),
    student_password TEXT,
    edit_password TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_ocr_results_exam_id ON ocr_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_ocr_results_pdf_hash ON ocr_results(pdf_hash);
CREATE INDEX IF NOT EXISTS idx_explanations_ocr_result_id ON explanations(ocr_result_id);
CREATE INDEX IF NOT EXISTS idx_analyses_ocr_result_id ON analyses(ocr_result_id);

-- RLS 정책 (필요시)
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocr_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE explanations ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

-- 모든 접근 허용 (개발용, 프로덕션에서는 수정 필요)
CREATE POLICY "Allow all" ON exams FOR ALL USING (true);
CREATE POLICY "Allow all" ON ocr_results FOR ALL USING (true);
CREATE POLICY "Allow all" ON explanations FOR ALL USING (true);
CREATE POLICY "Allow all" ON analyses FOR ALL USING (true);
