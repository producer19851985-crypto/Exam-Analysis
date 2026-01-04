CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  school_name VARCHAR(255) NOT NULL,
  grade VARCHAR(10) NOT NULL,
  exam_name VARCHAR(255) NOT NULL,
  student_password VARCHAR(255) NOT NULL,
  edit_password VARCHAR(255) NOT NULL,
  vocabulary_level VARCHAR(20) DEFAULT 'teps_850',
  use_pro_model BOOLEAN DEFAULT true,
  status VARCHAR(20) DEFAULT 'processing',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE uploaded_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  file_type VARCHAR(20) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE extracted_texts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_id UUID REFERENCES uploaded_files(id) ON DELETE CASCADE,
  page_number INTEGER,
  extracted_text TEXT,
  confidence FLOAT,
  extracted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type VARCHAR(50),
  source_type VARCHAR(20),
  source_confidence FLOAT,
  source_file_id UUID REFERENCES uploaded_files(id),
  source_question_number INTEGER,
  source_text TEXT,
  difficulty VARCHAR(10),
  analysis JSONB,
  teacher_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE summary_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  total_questions INTEGER,
  direct_count INTEGER,
  indirect_count INTEGER,
  external_count INTEGER,
  source_distribution JSONB,
  type_distribution JSONB,
  overall_difficulty VARCHAR(10),
  difficulty_analysis JSONB,
  learning_strategies JSONB,
  key_patterns JSONB,
  high_difficulty_vocabulary JSONB,
  teacher_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_uploaded_files_report ON uploaded_files(report_id);
CREATE INDEX idx_questions_report ON questions(report_id);
CREATE INDEX idx_summary_reports_report ON summary_reports(report_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE extracted_texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE summary_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read for reports with password" ON reports FOR SELECT USING (true);
CREATE POLICY "Public insert for reports" ON reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update for reports" ON reports FOR UPDATE USING (true);

CREATE POLICY "Public access for uploaded_files" ON uploaded_files FOR ALL USING (true);
CREATE POLICY "Public access for extracted_texts" ON extracted_texts FOR ALL USING (true);
CREATE POLICY "Public access for questions" ON questions FOR ALL USING (true);
CREATE POLICY "Public access for summary_reports" ON summary_reports FOR ALL USING (true);
