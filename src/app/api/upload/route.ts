import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const isSupabaseConfigured = supabaseUrl && supabaseServiceKey;

const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const examFile = formData.get('exam') as File | null;
    const mockFiles = formData.getAll('mock') as File[];
    const textbookFiles = formData.getAll('textbook') as File[];
    const settingsJson = formData.get('settings') as string;

    if (!examFile) {
      return NextResponse.json(
        { success: false, error: '기출문제 PDF가 필요합니다.' },
        { status: 400 }
      );
    }

    const settings = JSON.parse(settingsJson);

    if (!settings.school_name || !settings.exam_name) {
      return NextResponse.json(
        { success: false, error: '학교명과 시험명은 필수입니다.' },
        { status: 400 }
      );
    }

    if (!settings.student_password || !settings.edit_password) {
      return NextResponse.json(
        { success: false, error: '비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    const reportId = uuidv4();
    const hashedStudentPassword = await bcrypt.hash(settings.student_password, 10);
    const hashedEditPassword = await bcrypt.hash(settings.edit_password, 10);

    if (supabase) {
      const { error: reportError } = await supabase.from('reports').insert({
        id: reportId,
        school_name: settings.school_name,
        grade: settings.grade,
        exam_name: settings.exam_name,
        student_password: hashedStudentPassword,
        edit_password: hashedEditPassword,
        vocabulary_level: settings.vocabulary_level,
        use_pro_model: settings.use_pro_model,
        status: 'processing',
      });

      if (reportError) {
        console.error('Report insert error:', reportError);
        return NextResponse.json(
          { success: false, error: '리포트 생성에 실패했습니다.' },
          { status: 500 }
        );
      }

      const uploadFile = async (file: File, fileType: string) => {
        const buffer = await file.arrayBuffer();
        const filePath = `${reportId}/${fileType}/${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(filePath, buffer, {
            contentType: 'application/pdf',
          });

        if (uploadError) {
          console.error('File upload error:', uploadError);
          return null;
        }

        const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(filePath);

        const { error: fileRecordError } = await supabase.from('uploaded_files').insert({
          report_id: reportId,
          file_type: fileType,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_size: file.size,
        });

        if (fileRecordError) {
          console.error('File record error:', fileRecordError);
        }

        return urlData.publicUrl;
      };

      await uploadFile(examFile, 'exam');
      for (const file of mockFiles) {
        await uploadFile(file, 'mock');
      }
      for (const file of textbookFiles) {
        await uploadFile(file, 'textbook');
      }
    } else {
      console.log('Mock mode - Supabase not configured');
      console.log('Created report:', {
        id: reportId,
        school_name: settings.school_name,
        exam_name: settings.exam_name,
        files: {
          exam: examFile.name,
          mock: mockFiles.map((f) => f.name),
          textbook: textbookFiles.map((f) => f.name),
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        report_id: reportId,
        message: '분석을 시작합니다.',
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: '업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
