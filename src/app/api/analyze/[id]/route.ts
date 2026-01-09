import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { runMatchingAnalysis, runDetailedAnalysis, extractQuestionsFromPDF, extractSourcesFromPDF, MatchResult, ConfirmedMatch, DetailedAnalysis, ExtractedSource, ExtractedQuestion } from '@/lib/analyzer';
import { computePdfHash } from '@/lib/utils';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AnalysisCache {
  status: string;
  step: string;
  progress: number;
  questions?: ExtractedQuestion[];
  matches?: MatchResult[];
  sources?: Array<{ name: string; texts: ExtractedSource[] }>;
  sourcePdfs?: Array<{ name: string; base64: string }>;
  analysis?: DetailedAnalysis[];
  error?: string;
  answerKey?: string;
  examBase64?: string;
}

const progressCache = new Map<string, AnalysisCache>();

function log(msg: string, data?: unknown) {
  console.log(`[API] ${msg}`, data ? JSON.stringify(data).substring(0, 200) : '');
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const cached = progressCache.get(id);
  if (cached && (cached.status === 'extracting' || cached.status === 'ocr_review' || cached.status === 'matching' || cached.status === 'matching_review' || cached.status === 'analyzing')) {
    return NextResponse.json({ success: true, data: cached });
  }

  const { data: report, error } = await supabase
    .from('reports')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !report) {
    if (cached) {
      return NextResponse.json({ success: true, data: cached });
    }
    return NextResponse.json({ success: false, error: '분석을 찾을 수 없습니다.' }, { status: 404 });
  }

  const { data: questions, error: questionsError } = await supabase
    .from('questions')
    .select('*')
    .eq('report_id', id)
    .order('question_number');

  log(`GET ${id}: status=${report.status}, questions=${questions?.length ?? 0}, error=${questionsError?.message ?? 'none'}`);

  let matches: MatchResult[] | undefined;
  let analysis: DetailedAnalysis[] | undefined;

  // sources 데이터 미리 로드 (source_text 복구용)
  const savedSources: Array<{ name: string; texts: Array<{ number: number; text: string }> }> =
    report.metadata?.sources || report.metadata?.ocr_sources || [];

  log(`savedSources 수: ${savedSources.length}, 파일명: ${savedSources.map(s => s.name).join(', ')}`);

  // source_text가 비어있을 때 sources에서 찾아서 채우는 헬퍼 함수
  const findSourceText = (sourceName: string | undefined, sourceNumber: number | null, reasoning: string | undefined): string => {
    if (!sourceName) return '';

    // 교과서/본문인 경우 특별 처리
    const isTextbook = /교과서|본문|과_본문|과 본문/.test(sourceName);

    if (isTextbook) {
      // sourceName에서 "N과" 패턴 추출
      const lessonMatch = sourceName.match(/(\d+)과/);
      const lessonNum = lessonMatch ? lessonMatch[1] : null;

      // 정규화: 공백/언더스코어 통일
      const normalizedSourceName = sourceName.replace(/[\s_]+/g, '').toLowerCase();

      for (const sf of savedSources) {
        const normalizedFileName = sf.name.replace(/[\s_]+/g, '').toLowerCase();

        // 같은 과인지 확인
        if (lessonNum && normalizedFileName.includes(`${lessonNum}과`)) {
          // reasoning에서 _1 또는 _2 추출 시도
          let textIndex = 1; // 기본값
          if (reasoning) {
            const idMatch = reasoning.match(/본문_(\d+)/);
            if (idMatch) {
              textIndex = parseInt(idMatch[1]);
            }
          }
          const found = sf.texts.find(t => t.number === textIndex) || sf.texts[0];
          if (found) return found.text;
        }

        // 파일명 직접 비교
        if (normalizedFileName.includes(normalizedSourceName.slice(0, 20)) ||
            normalizedSourceName.includes(normalizedFileName.slice(0, 20))) {
          const found = sf.texts[0]; // 교과서는 첫 번째 텍스트 사용
          if (found) return found.text;
        }
      }
    }

    // 모의고사 등 일반 처리
    let effectiveSourceNumber = sourceNumber;

    if (!effectiveSourceNumber && sourceName) {
      // "2024년 10월 고1 모의고사 25번" 형태에서 번호 추출
      const numMatch = sourceName.match(/(\d+)번$/);
      if (numMatch) {
        effectiveSourceNumber = parseInt(numMatch[1]);
      }
    }

    // reasoning에서 ID 추출 시도: "[ID: 파일명_26]" 형태
    if (!effectiveSourceNumber && reasoning) {
      const idMatch = reasoning.match(/ID:\s*[^_\]]+_(\d+)/);
      if (idMatch) {
        effectiveSourceNumber = parseInt(idMatch[1]);
      }
    }

    if (!effectiveSourceNumber) return '';

    for (const sf of savedSources) {
      if (sourceName.includes(sf.name) || sf.name.includes(sourceName.split(' ')[0])) {
        const found = sf.texts.find(t => t.number === effectiveSourceNumber);
        if (found) return found.text;
      }
    }
    // 번호만으로 검색
    for (const sf of savedSources) {
      const found = sf.texts.find(t => t.number === effectiveSourceNumber);
      if (found) return found.text;
    }
    return '';
  };

  if (questions && questions.length > 0) {
    // matching_review 또는 saved 상태에서 matches 반환
    if (report.status === 'matching_review' || report.status === 'saved') {
      matches = questions.map(q => {
        let sourceText = q.source_text || '';
        // source_text가 비어있으면 sources에서 찾아서 채움
        if (!sourceText) {
          sourceText = findSourceText(q.analysis?.source_name, q.source_question_number, q.analysis?.reasoning);
        }
        return {
          questionNumber: q.question_number,
          questionText: q.question_text,
          sourceType: q.source_type || 'external',
          sourceName: q.analysis?.source_name || '외부지문',
          sourceNumber: q.source_question_number,
          sourceText,
          confidence: q.source_confidence || 0,
          reasoning: q.analysis?.reasoning || '',
        };
      });
    } else if (['review', 'approved', 'published', 'rejected'].includes(report.status)) {
      analysis = questions.map(q => ({
        questionNumber: q.question_number,
        questionText: q.question_text || '',
        sourceType: q.source_type || 'external',
        sourceName: q.analysis?.source_name || '외부지문',
        sourceNumber: q.source_question_number,
        questionType: q.question_type || '기타',
        difficulty: q.difficulty || 'medium',
        sentenceComparisons: q.analysis?.sentence_comparisons || [],
        vocabularyChanges: q.analysis?.vocabulary_changes || [],
        grammarPoints: q.analysis?.grammar_points || [],
        transformationSummary: q.analysis?.transformation_summary || '',
        teacherIntent: q.analysis?.teacher_intent || '',
        answerRationale: q.analysis?.answer_rationale || '',
        studyTips: q.analysis?.study_tips || [],
      }));
    }
  }

  let ocrQuestions: ExtractedQuestion[] | undefined;
  let ocrSources: Array<{ name: string; texts: ExtractedSource[] }> | undefined;

  if (report.metadata) {
    // ocr_review 또는 matching_review 상태 모두에서 sources 제공
    ocrQuestions = report.metadata.ocr_questions;
    ocrSources = report.metadata.ocr_sources || report.metadata.sources;
  }

  const responseData = {
    status: report.status,
    step: report.status === 'published' ? '게시됨' : '대기중',
    progress: 100,
    matches,
    analysis,
    sources: cached?.sources || ocrSources,
    questions: ocrQuestions,
    answerKey: report.metadata?.answer_key,
    rejectionFeedback: report.error_message,
  };

  return NextResponse.json({ success: true, data: responseData });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { action } = body;

  log(`POST ${id}, action: ${action}`);

  try {
    switch (action) {
      case 'start_from_ocr': {
        const { ocrResultId, sources: sourcePdfs, metadata } = body;
        
        if (!ocrResultId) {
          return NextResponse.json({ success: false, error: 'OCR 결과 ID가 필요합니다.' }, { status: 400 });
        }

        const { data: ocrResult, error: ocrError } = await supabase
          .from('ocr_results')
          .select(`
            id,
            questions,
            answer_key,
            exams (
              school_name,
              grade,
              exam_name
            )
          `)
          .eq('id', ocrResultId)
          .single();

        if (ocrError || !ocrResult) {
          return NextResponse.json({ success: false, error: 'OCR 결과를 찾을 수 없습니다.' }, { status: 404 });
        }

        const questions: ExtractedQuestion[] = ocrResult.questions || [];
        const answerKey = ocrResult.answer_key || '';
        const examData = ocrResult.exams;
        const examInfo = Array.isArray(examData) ? examData[0] : examData;

        await supabase.from('reports').upsert({
          id,
          school_name: metadata?.school_name || examInfo?.school_name || '',
          grade: metadata?.grade || examInfo?.grade || '고1',
          exam_name: metadata?.exam_name || examInfo?.exam_name || '시험',
          student_password: metadata?.student_password || '1234',
          edit_password: metadata?.edit_password || 'admin',
          vocabulary_level: metadata?.vocabulary_level || 'teps_850',
          status: 'matching',
          metadata: { answer_key: answerKey, ocr_result_id: ocrResultId },
        });

        progressCache.set(id, { status: 'matching', step: '원문 분석 중', progress: 0, answerKey });

        const finalSources: Array<{ name: string; base64: string }> = [];
        for (const src of (sourcePdfs || [])) {
          if (src.base64) {
            finalSources.push({ name: src.name, base64: src.base64 });
          }
        }

        (async () => {
          try {
            progressCache.set(id, { ...progressCache.get(id)!, step: '원문 PDF 분석 중', progress: 20 });
            
            const sources: Array<{ name: string; texts: ExtractedSource[] }> = [];
            for (let i = 0; i < finalSources.length; i++) {
              const src = finalSources[i];
              const texts = await extractSourcesFromPDF(src.base64);
              sources.push({ name: src.name, texts });
              progressCache.set(id, { 
                ...progressCache.get(id)!, 
                step: `원문 분석: ${src.name}`, 
                progress: 20 + Math.floor((i + 1) / finalSources.length * 30) 
              });
            }

            progressCache.set(id, { ...progressCache.get(id)!, step: '매칭 분석 중', progress: 50 });

            const allSources = sources.flatMap(s => 
              s.texts.map((t, idx) => ({ 
                id: `${s.name}_${t.number || idx}`,
                name: s.name, 
                number: t.number, 
                text: t.text,
              }))
            );

            const matches: MatchResult[] = [];
            
            if (allSources.length === 0) {
              for (const q of questions) {
                matches.push({
                  questionNumber: q.number,
                  questionText: q.text,
                  sourceType: 'external',
                  sourceName: '외부지문',
                  sourceNumber: null,
                  sourceText: '',
                  confidence: 0,
                  reasoning: '원문 PDF가 제공되지 않았습니다.',
                });
              }
            } else {
              const { runMatchingWithGroups } = await import('@/lib/analyzer');
              const matchResults = await runMatchingWithGroups(questions, allSources, answerKey, [], (step, progress) => {
                progressCache.set(id, { ...progressCache.get(id)!, step, progress: 50 + Math.floor(progress * 0.5) });
              });
              matches.push(...matchResults);
            }

            for (const match of matches) {
              await supabase.from('questions').upsert({
                report_id: id,
                question_number: match.questionNumber,
                question_text: match.questionText,
                source_type: match.sourceType,
                source_confidence: match.confidence,
                source_question_number: match.sourceNumber,
                source_text: match.sourceText,
                analysis: { source_name: match.sourceName, reasoning: match.reasoning },
              }, { onConflict: 'report_id,question_number' });
            }

            // sources를 metadata에 저장하여 나중에 드롭다운에서 사용할 수 있도록 함
            const { data: reportForMeta } = await supabase.from('reports').select('metadata').eq('id', id).single();
            await supabase.from('reports').update({
              status: 'matching_review',
              metadata: { ...reportForMeta?.metadata, sources }
            }).eq('id', id);
            progressCache.set(id, { status: 'matching_review', step: '매칭 검토 대기', progress: 100, matches, sources });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '매칭 오류';
            await supabase.from('reports').update({ status: 'error', error_message: errorMessage }).eq('id', id);
            progressCache.set(id, { status: 'error', step: '오류', progress: 0, error: errorMessage });
          }
        })();

        return NextResponse.json({ success: true, message: '매칭 분석 시작됨' });
      }

      case 'start_from_explanation': {
        const { explanationId, ocrResultId, sources: sourcePdfs, metadata } = body;
        
        if (!explanationId || !ocrResultId) {
          return NextResponse.json({ success: false, error: '해설 결과 ID와 OCR 결과 ID가 필요합니다.' }, { status: 400 });
        }

        const { data: ocrResult, error: ocrError } = await supabase
          .from('ocr_results')
          .select(`
            id,
            questions,
            answer_key,
            exams (
              school_name,
              grade,
              exam_name
            )
          `)
          .eq('id', ocrResultId)
          .single();

        if (ocrError || !ocrResult) {
          return NextResponse.json({ success: false, error: 'OCR 결과를 찾을 수 없습니다.' }, { status: 404 });
        }

        const questions: ExtractedQuestion[] = ocrResult.questions || [];
        const answerKey = ocrResult.answer_key || '';
        const examData = ocrResult.exams;
        const examInfo = Array.isArray(examData) ? examData[0] : examData;

        await supabase.from('reports').upsert({
          id,
          school_name: metadata?.school_name || examInfo?.school_name || '',
          grade: metadata?.grade || examInfo?.grade || '고1',
          exam_name: metadata?.exam_name || examInfo?.exam_name || '시험',
          student_password: '1234',
          edit_password: 'admin',
          vocabulary_level: metadata?.vocabulary_level || 'teps_850',
          status: 'matching',
          metadata: { answer_key: answerKey, ocr_result_id: ocrResultId, explanation_id: explanationId },
        });

        progressCache.set(id, { status: 'matching', step: '원문 분석 중', progress: 0, answerKey });

        const finalSources: Array<{ name: string; base64: string }> = [];
        for (const src of (sourcePdfs || [])) {
          if (src.base64) {
            finalSources.push({ name: src.name, base64: src.base64 });
          }
        }

        (async () => {
          try {
            progressCache.set(id, { ...progressCache.get(id)!, step: '원문 PDF 분석 중', progress: 20 });
            
            const sources: Array<{ name: string; texts: ExtractedSource[] }> = [];
            for (let i = 0; i < finalSources.length; i++) {
              const src = finalSources[i];
              const texts = await extractSourcesFromPDF(src.base64);
              sources.push({ name: src.name, texts });
              progressCache.set(id, { 
                ...progressCache.get(id)!, 
                step: `원문 분석: ${src.name}`, 
                progress: 20 + Math.floor((i + 1) / finalSources.length * 30) 
              });
            }

            progressCache.set(id, { ...progressCache.get(id)!, step: '매칭 분석 중', progress: 50 });

            const allSources = sources.flatMap(s => 
              s.texts.map((t, idx) => ({ 
                id: `${s.name}_${t.number || idx}`,
                name: s.name, 
                number: t.number, 
                text: t.text,
              }))
            );

            const matches: MatchResult[] = [];
            
            if (allSources.length === 0) {
              for (const q of questions) {
                matches.push({
                  questionNumber: q.number,
                  questionText: q.text,
                  sourceType: 'external',
                  sourceName: '외부지문',
                  sourceNumber: null,
                  sourceText: '',
                  confidence: 0,
                  reasoning: '원문 PDF가 제공되지 않았습니다.',
                });
              }
            } else {
              const { runMatchingWithGroups } = await import('@/lib/analyzer');
              const matchResults = await runMatchingWithGroups(questions, allSources, answerKey, [], (step, progress) => {
                progressCache.set(id, { ...progressCache.get(id)!, step, progress: 50 + Math.floor(progress * 0.5) });
              });
              matches.push(...matchResults);
            }

            const saveResults = await Promise.all(
              matches.map(match => 
                supabase.from('questions').upsert({
                  report_id: id,
                  question_number: match.questionNumber,
                  question_text: match.questionText,
                  source_type: match.sourceType,
                  source_confidence: match.confidence,
                  source_question_number: match.sourceNumber,
                  source_text: match.sourceText,
                  analysis: { source_name: match.sourceName, reasoning: match.reasoning },
                }, { onConflict: 'report_id,question_number' })
              )
            );
            
            const failedSaves = saveResults.filter(r => r.error);
            if (failedSaves.length > 0) {
              log(`Failed to save ${failedSaves.length}/${matches.length} questions`);
            }
            log(`Saved ${matches.length - failedSaves.length} questions for ${id}`);

            // sources를 metadata에 저장하여 나중에 드롭다운에서 사용할 수 있도록 함
            const { data: reportForMeta } = await supabase.from('reports').select('metadata').eq('id', id).single();
            await supabase.from('reports').update({
              status: 'matching_review',
              metadata: { ...reportForMeta?.metadata, sources }
            }).eq('id', id);
            progressCache.set(id, { status: 'matching_review', step: '매칭 검토 대기', progress: 100, matches, sources });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '매칭 오류';
            await supabase.from('reports').update({ status: 'error', error_message: errorMessage }).eq('id', id);
            progressCache.set(id, { status: 'error', step: '오류', progress: 0, error: errorMessage });
          }
        })();

        return NextResponse.json({ success: true, message: '매칭 분석 시작됨' });
      }

      case 'start_ocr': {
        const { examUrl, examBase64, sources: sourcePdfs, metadata } = body;
        
        let finalExamBase64 = examBase64;
        
        if (examUrl && !examBase64) {
          try {
            const res = await fetch(examUrl);
            const buffer = await res.arrayBuffer();
            finalExamBase64 = Buffer.from(buffer).toString('base64');
          } catch (e) {
            return NextResponse.json({ success: false, error: 'PDF 다운로드 실패' }, { status: 400 });
          }
        }
        
        if (!finalExamBase64) {
          return NextResponse.json({ success: false, error: 'PDF가 필요합니다.' }, { status: 400 });
        }

        const pdfHash = computePdfHash(finalExamBase64);
        log(`PDF 해시: ${pdfHash}`);
        const answerKey = metadata?.answer_key || '';
        
        const { data: cachedOcr, error: cacheError } = await supabase
          .from('ocr_cache')
          .select('*')
          .eq('pdf_hash', pdfHash)
          .single();

        if (cacheError) {
          log(`OCR 캐시 조회: ${cacheError.code === 'PGRST116' ? '캐시 없음 (신규 PDF)' : cacheError.message}`);
        }

        if (cachedOcr) {
          log(`OCR 캐시 사용: ${pdfHash}`);
          
          await supabase.from('reports').upsert({
            id,
            school_name: metadata?.school_name || '',
            grade: metadata?.grade || '고1',
            exam_name: metadata?.exam_name || '시험',
            student_password: metadata?.student_password || '1234',
            edit_password: metadata?.edit_password || 'admin',
            vocabulary_level: metadata?.vocabulary_level || 'teps_850',
            status: 'ocr_review',
            metadata: { 
              answer_key: cachedOcr.answer_key || answerKey, 
              pdf_hash: pdfHash,
              ocr_questions: cachedOcr.questions,
              ocr_sources: cachedOcr.sources,
              from_cache: true,
            },
          });

          progressCache.set(id, {
            status: 'ocr_review',
            step: 'OCR 캐시 사용',
            progress: 100,
            questions: cachedOcr.questions,
            sources: cachedOcr.sources,
            answerKey: cachedOcr.answer_key || answerKey,
            examBase64: finalExamBase64,
          });

          return NextResponse.json({ success: true, message: 'OCR 캐시 사용', fromCache: true });
        }
        
        await supabase.from('reports').upsert({
          id,
          school_name: metadata?.school_name || '',
          grade: metadata?.grade || '고1',
          exam_name: metadata?.exam_name || '시험',
          student_password: metadata?.student_password || '1234',
          edit_password: metadata?.edit_password || 'admin',
          vocabulary_level: metadata?.vocabulary_level || 'teps_850',
          status: 'extracting',
          metadata: { answer_key: answerKey, page_layout: metadata?.page_layout || '', pdf_hash: pdfHash },
        });

        progressCache.set(id, { status: 'extracting', step: 'PDF 텍스트 추출', progress: 0, answerKey });

        const finalSources: Array<{ name: string; base64: string }> = [];
        for (const src of (sourcePdfs || [])) {
          if (src.base64) {
            finalSources.push({ name: src.name, base64: src.base64 });
          } else if (src.url) {
            try {
              const res = await fetch(src.url);
              if (res.ok) {
                const buffer = await res.arrayBuffer();
                finalSources.push({ name: src.name, base64: Buffer.from(buffer).toString('base64') });
              }
            } catch (e) {
              log(`Source download failed: ${src.name}`);
            }
          }
        }

        (async () => {
          try {
            progressCache.set(id, { ...progressCache.get(id)!, step: '기출문제 추출 중', progress: 20 });
            const questions = await extractQuestionsFromPDF(finalExamBase64);
            
            progressCache.set(id, { ...progressCache.get(id)!, step: '원문 추출 중', progress: 60 });
            const sources: Array<{ name: string; texts: ExtractedSource[] }> = [];
            for (const src of finalSources) {
              const texts = await extractSourcesFromPDF(src.base64);
              sources.push({ name: src.name, texts });
            }

            await supabase.from('reports').update({ 
              status: 'ocr_review',
              metadata: {
                answer_key: answerKey,
                ocr_questions: questions,
                ocr_sources: sources,
                pdf_hash: pdfHash,
              }
            }).eq('id', id);

            progressCache.set(id, {
              status: 'ocr_review',
              step: 'OCR 검토 대기',
              progress: 100,
              questions,
              sources,
              sourcePdfs: finalSources,
              answerKey,
              examBase64: finalExamBase64,
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'OCR 오류';
            await supabase.from('reports').update({ status: 'error', error_message: errorMessage }).eq('id', id);
            progressCache.set(id, { status: 'error', step: '오류', progress: 0, error: errorMessage });
          }
        })();

        return NextResponse.json({ success: true, message: 'OCR 시작됨' });
      }

      case 'confirm_ocr': {
        const { questions: editedQuestions, answerKey: newAnswerKey, groups } = body;
        const cached = progressCache.get(id);
        
        const { data: reportData } = await supabase
          .from('reports')
          .select('metadata')
          .eq('id', id)
          .single();
        
        if (!cached?.examBase64 && !reportData?.metadata?.ocr_questions) {
          return NextResponse.json({ success: false, error: '캐시된 데이터가 없습니다. 다시 업로드해주세요.' }, { status: 400 });
        }

        const answerKey = newAnswerKey || cached?.answerKey || reportData?.metadata?.answer_key || '';
        const sources: Array<{ name: string; texts: ExtractedSource[] }> = cached?.sources || reportData?.metadata?.ocr_sources || [];
        const pdfHash = reportData?.metadata?.pdf_hash;
        
        if (pdfHash) {
          const { error: cacheError } = await supabase.from('ocr_cache').upsert({
            pdf_hash: pdfHash,
            questions: editedQuestions,
            sources: sources,
            answer_key: answerKey,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'pdf_hash' });
          
          if (cacheError) {
            log(`OCR 캐시 저장 실패: ${cacheError.message}`);
          } else {
            log(`OCR 캐시 저장 성공: ${pdfHash}`);
          }
        } else {
          log(`OCR 캐시 저장 스킵: pdf_hash 없음`);
        }
        
        await supabase.from('reports').update({ 
          metadata: { answer_key: answerKey, groups: groups || [], pdf_hash: pdfHash }
        }).eq('id', id);

        await supabase.from('reports').update({ status: 'matching' }).eq('id', id);
        progressCache.set(id, { status: 'matching', step: '매칭 분석 중', progress: 0, answerKey });

        (async () => {
          try {
            const allSources = sources.flatMap(s => 
              s.texts.map((t, idx) => ({ 
                id: `${s.name}_${t.number || idx}`,
                name: s.name, 
                number: t.number, 
                text: t.text,
              }))
            );

            const matches: MatchResult[] = [];
            
            if (allSources.length === 0) {
              for (const q of editedQuestions) {
                matches.push({
                  questionNumber: q.number,
                  questionText: q.text,
                  sourceType: 'external',
                  sourceName: '외부지문',
                  sourceNumber: null,
                  sourceText: '',
                  confidence: 0,
                  reasoning: '원문 PDF가 제공되지 않았습니다.',
                });
              }
            } else {
              const { runMatchingWithGroups } = await import('@/lib/analyzer');
              const matchResults = await runMatchingWithGroups(editedQuestions, allSources, answerKey, groups || [], (step, progress) => {
                progressCache.set(id, { ...progressCache.get(id)!, step, progress });
              });
              matches.push(...matchResults);
            }

            for (const match of matches) {
              await supabase.from('questions').upsert({
                report_id: id,
                question_number: match.questionNumber,
                question_text: match.questionText,
                source_type: match.sourceType,
                source_confidence: match.confidence,
                source_question_number: match.sourceNumber,
                source_text: match.sourceText,
                analysis: { source_name: match.sourceName, reasoning: match.reasoning },
              }, { onConflict: 'report_id,question_number' });
            }

            // sources를 metadata에 저장하여 나중에 드롭다운에서 사용할 수 있도록 함
            const { data: reportForMeta } = await supabase.from('reports').select('metadata').eq('id', id).single();
            await supabase.from('reports').update({
              status: 'matching_review',
              metadata: { ...reportForMeta?.metadata, sources }
            }).eq('id', id);
            progressCache.set(id, { status: 'matching_review', step: '매칭 검토 대기', progress: 100, matches, sources });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : '매칭 오류';
            await supabase.from('reports').update({ status: 'error', error_message: errorMessage }).eq('id', id);
            progressCache.set(id, { status: 'error', step: '오류', progress: 0, error: errorMessage });
          }
        })();

        return NextResponse.json({ success: true, message: '매칭 분석 시작됨' });
      }

      case 'start_matching': {
        const { examUrl, examBase64, sources: sourcePdfs, metadata } = body;
        
        let finalExamBase64 = examBase64;
        
        if (examUrl && !examBase64) {
          try {
            const res = await fetch(examUrl);
            const buffer = await res.arrayBuffer();
            finalExamBase64 = Buffer.from(buffer).toString('base64');
          } catch (e) {
            return NextResponse.json({ success: false, error: '기출문제 PDF 다운로드 실패' }, { status: 400 });
          }
        }
        
        if (!finalExamBase64) {
          return NextResponse.json({ success: false, error: '기출문제 PDF가 필요합니다.' }, { status: 400 });
        }

        const answerKey = metadata?.answer_key || '';
        const pageLayout = metadata?.page_layout || '';
        
        const { error: insertError } = await supabase
          .from('reports')
          .upsert({
            id,
            school_name: metadata?.school_name || '미지정',
            grade: metadata?.grade || '고1',
            exam_name: metadata?.exam_name || '시험',
            student_password: metadata?.student_password || '1234',
            edit_password: metadata?.edit_password || 'admin',
            vocabulary_level: metadata?.vocabulary_level || 'teps_850',
            status: 'matching',
            metadata: {
              answer_key: answerKey,
              page_layout: pageLayout,
            },
          });

        if (insertError) {
          log('Report insert error', insertError);
          return NextResponse.json({ success: false, error: `리포트 생성 실패: ${insertError.message}` }, { status: 500 });
        }

        progressCache.set(id, { status: 'matching', step: 'PDF 분석', progress: 0, answerKey });

        const finalSources: Array<{ name: string; base64: string }> = [];
        log(`원본 PDF 개수: ${(sourcePdfs || []).length}`);
        
        for (const src of (sourcePdfs || [])) {
          log(`처리 중: ${src.name}, base64: ${!!src.base64}, url: ${!!src.url}`);
          if (src.base64) {
            finalSources.push({ name: src.name, base64: src.base64 });
            log(`base64로 추가: ${src.name}`);
          } else if (src.url) {
            try {
              log(`다운로드 시작: ${src.url}`);
              const res = await fetch(src.url);
              if (!res.ok) {
                log(`다운로드 실패: ${res.status} ${res.statusText}`);
                continue;
              }
              const buffer = await res.arrayBuffer();
              finalSources.push({ name: src.name, base64: Buffer.from(buffer).toString('base64') });
              log(`다운로드 완료: ${src.name}, 크기: ${(buffer.byteLength / 1024 / 1024).toFixed(2)}MB`);
            } catch (e) {
              log(`Source download failed: ${src.name}, error: ${e}`);
            }
          }
        }
        
        log(`최종 원본 PDF 개수: ${finalSources.length}`);

        runMatchingAnalysis(
          finalExamBase64, 
          finalSources, 
          answerKey,
          pageLayout,
          (step, progress) => {
            const current = progressCache.get(id);
            if (current) progressCache.set(id, { ...current, step, progress });
            log(`진행: ${step} (${progress}%)`);
          }
        ).then(async ({ matches, sources }) => {
          log(`분석 완료: ${matches.length}개 문항`);

          for (const match of matches) {
            await supabase.from('questions').upsert({
              report_id: id,
              question_number: match.questionNumber,
              question_text: match.questionText,
              source_type: match.sourceType,
              source_confidence: match.confidence,
              source_question_number: match.sourceNumber,
              source_text: match.sourceText,
              analysis: { source_name: match.sourceName, reasoning: match.reasoning },
            }, { onConflict: 'report_id,question_number' });
          }

          await supabase
            .from('reports')
            .update({ status: 'matching_review' })
            .eq('id', id);

          progressCache.set(id, {
            status: 'matching_review',
            step: '매칭 검토 대기',
            progress: 100,
            matches,
            sources,
          });
        }).catch(async (error) => {
          const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
          log('분석 오류', errorMessage);
          
          await supabase
            .from('reports')
            .update({ status: 'error', error_message: errorMessage })
            .eq('id', id);

          progressCache.set(id, {
            status: 'error',
            step: '오류',
            progress: 0,
            error: errorMessage,
          });
        });

        return NextResponse.json({ success: true, message: '매칭 분석 시작됨' });
      }

      case 'save_matches': {
        const { matches } = body;

        for (const match of matches) {
          await supabase.from('questions').upsert({
            report_id: id,
            question_number: match.questionNumber,
            question_text: match.questionText,
            source_type: match.sourceType,
            source_confidence: match.confidence || 0,
            source_text: match.sourceText,
            analysis: { source_name: match.sourceName, reasoning: match.reasoning || '' },
          }, { onConflict: 'report_id,question_number' });
        }

        await supabase.from('reports').update({ status: 'saved' }).eq('id', id);
        log(`${id}: ${matches.length}개 매칭 저장 완료 (분석 미진행)`);

        return NextResponse.json({ success: true, message: '저장 완료' });
      }

      case 'confirm_matches': {
        const { confirmedMatches } = body;

        const { data: report } = await supabase
          .from('reports')
          .select('vocabulary_level')
          .eq('id', id)
          .single();

        const vocabularyLevel = report?.vocabulary_level || 'teps_850';
        
        const cachedData = progressCache.get(id);
        const savedAnswerKey = cachedData?.answerKey || '';

        await supabase
          .from('reports')
          .update({ status: 'analyzing' })
          .eq('id', id);

        for (const match of confirmedMatches) {
          await supabase.from('questions').upsert({
            report_id: id,
            question_number: match.questionNumber,
            question_text: match.questionText,
            source_type: match.sourceType,
            source_text: match.sourceText,
            analysis: {
              source_name: match.sourceName,
            },
          }, { onConflict: 'report_id,question_number' });
        }

        progressCache.set(id, { status: 'analyzing', step: '상세 분석', progress: 0, answerKey: savedAnswerKey });

        runDetailedAnalysis(confirmedMatches, vocabularyLevel || 'teps_850', savedAnswerKey, (step, progress) => {
          const curr = progressCache.get(id);
          if (curr) progressCache.set(id, { ...curr, step, progress });
        })
          .then(async (analysis) => {
            for (const item of analysis) {
              await supabase
                .from('questions')
                .update({
                  question_type: item.questionType,
                  difficulty: item.difficulty,
                  analysis: {
                    source_name: item.sourceName,
                    sentence_comparisons: item.sentenceComparisons,
                    vocabulary_changes: item.vocabularyChanges,
                    grammar_points: item.grammarPoints,
                    wrong_answer_analysis: item.wrongAnswerAnalysis,
                    transformation_summary: item.transformationSummary,
                    teacher_intent: item.teacherIntent,
                    answer_rationale: item.answerRationale,
                    study_tips: item.studyTips,
                  },
                })
                .eq('report_id', id)
                .eq('question_number', item.questionNumber);
            }

            await supabase
              .from('reports')
              .update({ status: 'review' })
              .eq('id', id);

            progressCache.set(id, {
              status: 'review',
              step: '검토 대기',
              progress: 100,
              analysis,
            });
            log(`상세 분석 완료: ${analysis.length}개`);
          })
          .catch(async (error) => {
            await supabase
              .from('reports')
              .update({ status: 'error', error_message: error.message })
              .eq('id', id);

            progressCache.set(id, {
              status: 'analyzing',
              step: '오류',
              progress: 0,
              error: error.message,
            });
          });

        return NextResponse.json({ success: true, message: '상세 분석 시작' });
      }

      case 'approve': {
        await supabase
          .from('reports')
          .update({ status: 'approved' })
          .eq('id', id);

        return NextResponse.json({ success: true, message: '승인 완료' });
      }

      case 'publish': {
        const { student_password, edit_password } = body;
        
        if (!student_password || !edit_password) {
          return NextResponse.json({ success: false, error: '비밀번호를 입력해주세요.' }, { status: 400 });
        }

        await supabase
          .from('reports')
          .update({ 
            status: 'published', 
            completed_at: new Date().toISOString(),
            student_password,
            edit_password,
          })
          .eq('id', id);

        progressCache.delete(id);

        return NextResponse.json({ success: true, message: '게시 완료' });
      }

      case 'reject': {
        const { feedback } = body;
        
        await supabase
          .from('reports')
          .update({ status: 'rejected', error_message: feedback })
          .eq('id', id);

        return NextResponse.json({ success: true, message: '반려됨' });
      }

      case 'update_analysis': {
        const { analysis } = body;
        
        for (const item of analysis) {
          await supabase
            .from('questions')
            .update({
              difficulty: item.difficulty,
              analysis: {
                source_name: item.sourceName,
                sentence_comparisons: item.sentenceComparisons,
                vocabulary_changes: item.vocabularyChanges,
                grammar_points: item.grammarPoints,
                transformation_summary: item.transformationSummary,
                teacher_intent: item.teacherIntent,
                answer_rationale: item.answerRationale,
                study_tips: item.studyTips,
              },
            })
            .eq('report_id', id)
            .eq('question_number', item.questionNumber);
        }

        await supabase
          .from('reports')
          .update({ status: 'review', error_message: null })
          .eq('id', id);

        return NextResponse.json({ success: true, message: '수정 완료' });
      }

      case 'update_source_text': {
        const { questionNumber, sourceText } = body;
        
        if (!questionNumber) {
          return NextResponse.json({ success: false, error: '문항 번호가 필요합니다.' }, { status: 400 });
        }

        const { error: updateError } = await supabase
          .from('questions')
          .update({ source_text: sourceText })
          .eq('report_id', id)
          .eq('question_number', questionNumber);

        if (updateError) {
          return NextResponse.json({ success: false, error: '원문 저장 실패' }, { status: 500 });
        }

        log(`문항 ${questionNumber} 원문 업데이트 완료`);
        return NextResponse.json({ success: true, message: '원문 저장 완료' });
      }

      case 'reanalyze_single': {
        const { questionNumber, sourceType: newSourceType } = body;
        
        const { data: question } = await supabase
          .from('questions')
          .select('*')
          .eq('report_id', id)
          .eq('question_number', questionNumber)
          .single();
        
        if (!question) {
          return NextResponse.json({ success: false, error: '문항을 찾을 수 없습니다.' }, { status: 404 });
        }

        const { data: report } = await supabase
          .from('reports')
          .select('vocabulary_level, metadata')
          .eq('id', id)
          .single();

        const vocabularyLevel = report?.vocabulary_level || 'teps_850';
        const answerKey = report?.metadata?.answer_key || '';
        
        const effectiveSourceType = newSourceType || question.source_type || 'external';
        
        if (newSourceType && newSourceType !== question.source_type) {
          await supabase
            .from('questions')
            .update({ source_type: newSourceType })
            .eq('report_id', id)
            .eq('question_number', questionNumber);
        }
        
        const singleMatch: ConfirmedMatch = {
          questionNumber: question.question_number,
          questionText: question.question_text || '',
          sourceType: effectiveSourceType,
          sourceName: question.analysis?.source_name || '외부지문',
          sourceText: question.source_text || '',
        };

        try {
          const [reanalyzedItem] = await runDetailedAnalysis(
            [singleMatch], 
            vocabularyLevel, 
            answerKey
          );

          await supabase
            .from('questions')
            .update({
              question_type: reanalyzedItem.questionType,
              difficulty: reanalyzedItem.difficulty,
              analysis: {
                source_name: reanalyzedItem.sourceName,
                sentence_comparisons: reanalyzedItem.sentenceComparisons,
                vocabulary_changes: reanalyzedItem.vocabularyChanges,
                grammar_points: reanalyzedItem.grammarPoints,
                wrong_answer_analysis: reanalyzedItem.wrongAnswerAnalysis,
                transformation_summary: reanalyzedItem.transformationSummary,
                teacher_intent: reanalyzedItem.teacherIntent,
                answer_rationale: reanalyzedItem.answerRationale,
                study_tips: reanalyzedItem.studyTips,
              },
            })
            .eq('report_id', id)
            .eq('question_number', questionNumber);

          log(`문항 ${questionNumber} 재분석 완료`);
          
          return NextResponse.json({ 
            success: true, 
            message: '재분석 완료',
            analysis: reanalyzedItem 
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '재분석 실패';
          log(`문항 ${questionNumber} 재분석 오류: ${errorMessage}`);
          return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
        }
      }

      case 'delete_report': {
        await supabase.from('questions').delete().eq('report_id', id);
        await supabase.from('reports').delete().eq('id', id);
        progressCache.delete(id);
        log(`리포트 ${id} 삭제 완료`);
        return NextResponse.json({ success: true, message: '삭제 완료' });
      }

      default:
        return NextResponse.json({ success: false, error: '알 수 없는 액션' }, { status: 400 });
    }
  } catch (error) {
    log('API 오류', error);
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500 });
  }
}
