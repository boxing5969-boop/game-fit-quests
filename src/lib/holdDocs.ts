// 부상·질병 홀딩 서류(진단서·소견서 등) — 비공개 버킷 hold-docs.
// 경로 규약: {회원 user_id}/{timestamp}-{rand}.{jpg|png|pdf}
//  · 올리기: 본인 폴더만 (storage RLS hold_docs_insert_own)
//  · 보기/지우기: 본인 · 같은 지점 관장 · 본사 (public.can_access_hold_doc)
//  · 관장이 승인·반려하면 바로 지운다 — 건강정보는 처리에 필요한 동안만 보관.
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/imageCompression";

export const HOLD_DOCS_BUCKET = "hold-docs";
export const HOLD_DOC_ACCEPT = "image/*,application/pdf";

const MAX_RAW_BYTES = 20 * 1024 * 1024; // 고르는 원본 20MB까지
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 버킷 한도 10MB
const ORIGINAL_OK = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export const isPdfPath = (p: string) => /\.pdf$/i.test(p);

function extOf(type: string, name: string): string {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/heic" || /\.heic$/i.test(name)) return "heic";
  if (type === "image/heif" || /\.heif$/i.test(name)) return "heif";
  return "jpg";
}

/** 서류를 올리고 저장 경로를 돌려준다. 사진은 글자가 읽히게 긴 변 2000px JPEG로 줄인다. */
export async function uploadHoldDoc(userId: string, file: File): Promise<string> {
  if (file.size > MAX_RAW_BYTES) throw new Error("파일이 너무 커요 (20MB 이하)");
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isImage = file.type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);
  if (!isPdf && !isImage) throw new Error("사진(JPG·PNG) 또는 PDF 파일만 올릴 수 있어요");

  let body: Blob = file;
  let ext = "pdf";
  let contentType = "application/pdf";
  if (!isPdf && file.type === "image/png" && file.size <= MAX_UPLOAD_BYTES) {
    // PNG(화면 캡처 등)는 그대로 — JPEG로 바꾸면 투명 배경이 검게 칠해져 글자가 안 보일 수 있다
    ext = "png";
    contentType = "image/png";
  } else if (!isPdf) {
    try {
      body = await compressImage(file, 2000, 0.85);
      ext = "jpg";
      contentType = "image/jpeg";
    } catch {
      // 브라우저가 못 여는 형식(예: 안드로이드 크롬의 HEIC) — 허용 형식이면 원본 그대로
      if (!ORIGINAL_OK.includes(file.type)) throw new Error("사진을 열 수 없어요. 카메라로 다시 찍어 올려 주세요");
      body = file;
      ext = extOf(file.type, file.name);
      contentType = file.type;
    }
  }
  if (body.size > MAX_UPLOAD_BYTES) throw new Error("파일이 너무 커요 (10MB 이하로 올려 주세요)");

  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${userId}/${Date.now()}-${rand}.${ext}`;
  const { error } = await supabase.storage
    .from(HOLD_DOCS_BUCKET)
    .upload(path, body, { contentType, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

/** 서류 보기용 서명 URL (기본 5분). */
export async function holdDocSignedUrl(path: string, expiresSec = 300): Promise<string> {
  const { data, error } = await supabase.storage.from(HOLD_DOCS_BUCKET).createSignedUrl(path, expiresSec);
  if (error || !data?.signedUrl) throw new Error(error?.message || "서류를 열 수 없어요");
  return data.signedUrl;
}

/** 서류 삭제 — 실제로 지워졌으면 true (권한이 없거나 이미 없으면 오류 없이 빈 배열이 와서 false). 예외는 던지지 않는다. */
export async function removeHoldDoc(path: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.storage.from(HOLD_DOCS_BUCKET).remove([path]);
    return !error && Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

/**
 * 처리 끝난 신청의 서류를 지우고 '삭제됨'을 기록한다.
 * 기록 함수(mark_hold_doc_deleted)는 버킷에서 실제로 사라진 것을 확인한 뒤에만 남기므로,
 * 지우기가 실패했으면 false — 다음에 관장 화면이 열릴 때 다시 시도한다.
 */
export async function purgeHoldDoc(requestId: string, path: string): Promise<boolean> {
  await removeHoldDoc(path); // 이미 지워졌으면 false 지만 아래 확인으로 기록된다
  try {
    const { error } = await (supabase as any).rpc("mark_hold_doc_deleted", { _request_id: requestId });
    return !error;
  } catch {
    return false;
  }
}
