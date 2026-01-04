# 내신 기출문제 분석 툴

AI 기반 영어 내신 기출문제 분석 시스템

## 주요 기능

- PDF 업로드 (기출문제 + 모의고사 + 교과서)
- Gemini 3 Pro 기반 정밀 매칭
- 직접/간접/외부지문 연계 구분
- TEPS 830+ 고난도 어휘 추출
- 웹 리포트 + 비밀번호 보호
- 선생님 편집 모드

## 기술 스택

- Next.js 16
- Tailwind CSS
- Supabase (Database + Storage)
- Gemini 3 Pro API

## 설치

```bash
npm install
```

## 환경변수 설정

`.env.local` 파일 생성:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
GEMINI_API_KEY=your_gemini_api_key
```

## Supabase 설정

1. Supabase 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행
3. Storage에서 `supabase/storage.sql` 실행

## 개발 서버

```bash
npm run dev
```

## 배포

```bash
npx vercel
```

## 테스트

- 테스트 비밀번호: `test123`
