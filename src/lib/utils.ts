import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { createHash } from "crypto"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function computePdfHash(base64: string): string {
  return createHash('sha256').update(base64).digest('hex').substring(0, 16)
}

export function formatSourceName(sourceName: string | null | undefined, sourceNumber: number | null | undefined): string {
  if (!sourceName) return '매칭된 원문 없음';

  // 교과서는 번호 없이 "교과서 N과"로만 표시
  const isTextbook = /교과서|본문/.test(sourceName);
  if (isTextbook) {
    // "교과서 4과" 형태만 유지, 번호 제거
    return sourceName.replace(/_본문\s*\d*번?$/, '').replace(/\s*\d+번$/, '');
  }

  // 모의고사 등은 번호 포함
  if (sourceNumber && !sourceName.includes('번')) {
    return `${sourceName.replace(/ ?문제$/, '')} ${sourceNumber}번`;
  }
  return sourceName;
}
