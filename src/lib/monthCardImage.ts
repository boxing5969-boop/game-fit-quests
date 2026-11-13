/**
 * 🖼 이번 달 운동 카드 이미지 — 인스타 스토리 크기(1080×1920) PNG (2026-11-13 대표님 「시작하자」 · 운동 달력 2-4단계)
 *   무엇을 그릴지는 lib/calendarTogether monthCardModel 이 정하고, 이 파일은 그리기 · 저장만 한다(누를 때만 받는 조각 — MonthCardSheet).
 *   흰 바탕 + 위쪽 검은 띠(153 흰 로고 · 지점 이름 — 대표님 결정 「153 로고 · 지점 이름 넣기」) · 그 달 운동 시간 ·
 *   도장 달력(민트 · 기념일 금색 · 짝꿍과 같이 온 날 쌍도장) · 코치 한마디 · 153 서명. 빠진 날 표시는 없다(숫자만 흐리게).
 *   이미지는 기기에서 만들고 서버로 보내지 않는다. 휴대폰은 공유 창(인스타 스토리 · 사진 저장), 컴퓨터는 내려받기.
 */
import logoUrl from "@/assets/branding/153-logo-white.png";
import { monthDayLabel, type MonthCardModel } from "@/lib/calendarTogether";

export const CARD_W = 1080;
export const CARD_H = 1920;

const C = {
  ink: "#191F28",
  muted: "#6B7684",
  faint: "#9AA4B0",
  soft: "#F2F4F6",
  line: "#E5E8EB",
  mint: "#29C39C",
  mintSoft: "rgba(41, 195, 156, 0.12)",
  gold: "#F6C453",
  goldInk: "#151B27",
  sky: "#7DD3FC",
  band: "#191F28",
  bandSub: "#B0B8C1",
  white: "#FFFFFF",
};
const FONT = '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif';
const font = (weight: number, px: number) => `${weight} ${px}px ${FONT}`;
const PAD = 72;
const WEEK = ["월", "화", "수", "목", "금", "토", "일"];

type Ctx = CanvasRenderingContext2D;

/** 글자를 먼저 받아 둔다 (Pretendard 는 쓰는 글자 묶음만 내려받는다 — 못 받으면 기기 글꼴로) */
async function loadFonts(texts: string[]): Promise<void> {
  if (typeof document === "undefined" || !document.fonts?.load) return;
  const sample = texts.join(" ");
  const tasks = [800, 700, 600].map((w) => document.fonts.load(`${w} 40px "Pretendard Variable"`, sample).catch(() => []));
  await Promise.race([Promise.all(tasks), new Promise((r) => setTimeout(r, 2500))]);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx: Ctx, cx: number, cy: number, r: number, color: string) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

/** 너비에 맞춰 줄 나누기 — 띄어쓰기에서 먼저, 너무 긴 낱말은 글자에서 · 넘치면 마지막 줄 끝에 '…' */
export function wrapLines(measure: (s: string) => number, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  const push = (s: string) => {
    if (s) lines.push(s);
  };
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next) <= maxWidth) {
      cur = next;
      continue;
    }
    push(cur);
    cur = "";
    if (measure(w) <= maxWidth) {
      cur = w;
      continue;
    }
    // 낱말 하나가 너무 길면 글자에서 자른다
    let piece = "";
    for (const ch of [...w]) {
      if (measure(piece + ch) > maxWidth) {
        push(piece);
        piece = ch;
      } else piece += ch;
    }
    cur = piece;
  }
  push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last && measure(`${last}…`) > maxWidth) last = [...last].slice(0, -1).join("");
  kept[maxLines - 1] = `${last}…`;
  return kept;
}

/** 카드 한 장 그리기 → PNG */
export async function renderMonthCard(m: MonthCardModel): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("이 기기에서는 카드를 만들 수 없어요");
  const ym = `${m.month.slice(0, 4)}.${m.month.slice(5, 7)}`;
  const [logo] = await Promise.all([
    loadImage(logoUrl),
    loadFonts([m.title, m.minutesText, "운동했어요", m.gain ?? "", m.note?.body ?? "", m.note?.who ?? "", m.sign, m.branchShort ?? "", ym, "운동 카드 코치님 한마디 기념일 짝꿍과 같이", ...WEEK, "0123456789"]),
  ]);

  // 바탕
  ctx.fillStyle = C.white;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  ctx.textBaseline = "alphabetic";

  // ① 위쪽 띠 — 153 로고 · 지점 · 달
  ctx.fillStyle = C.band;
  ctx.fillRect(0, 0, CARD_W, 320);
  if (logo) {
    const w = 270;
    ctx.drawImage(logo, PAD, 60, w, (w * logo.height) / logo.width);
  } else {
    ctx.fillStyle = C.white;
    ctx.font = font(800, 64);
    ctx.fillText("153 BOXING GYM", PAD, 150);
  }
  if (m.branchShort) {
    ctx.fillStyle = C.mint;
    ctx.font = font(700, 40);
    ctx.fillText(m.branchShort, PAD, 262);
  }
  ctx.textAlign = "right";
  ctx.fillStyle = C.white;
  ctx.font = font(800, 60);
  ctx.fillText(ym, CARD_W - PAD, 150);
  ctx.fillStyle = C.bandSub;
  ctx.font = font(600, 34);
  ctx.fillText("운동 카드", CARD_W - PAD, 206);
  ctx.textAlign = "left";

  // ② 제목 · 운동 시간
  let y = 430;
  ctx.fillStyle = C.ink;
  ctx.font = font(700, 52);
  ctx.fillText(m.title, PAD, y);
  y += 160;
  ctx.font = font(800, 128);
  const numW = ctx.measureText(m.minutesText).width;
  ctx.fillText(m.minutesText, PAD, y);
  ctx.font = font(700, 52);
  ctx.fillStyle = C.muted;
  const sufW = ctx.measureText("운동했어요").width;
  if (PAD + numW + 24 + sufW <= CARD_W - PAD) {
    ctx.fillText("운동했어요", PAD + numW + 24, y);
    y += 36;
  } else {
    y += 80;
    ctx.fillText("운동했어요", PAD, y);
    y += 30;
  }
  if (m.gain) {
    ctx.font = font(700, 36);
    const gw = ctx.measureText(m.gain).width + 56;
    roundRect(ctx, PAD, y, gw, 66, 33);
    ctx.fillStyle = C.mintSoft;
    ctx.fill();
    ctx.fillStyle = C.mint;
    ctx.fillText(m.gain, PAD + 28, y + 45);
    y += 66;
  }

  // ③ 도장 달력 — 아래 코치 한마디 · 이름표까지 1780 안에 들어가게 줄 높이를 정한다
  const top = Math.max(y + 48, 700);
  const cells = m.weeks.flat();
  const legend = [
    ...(cells.some((c) => c.gold) ? [{ color: C.gold, label: "기념일" }] : []),
    ...(cells.some((c) => c.together) ? [{ color: C.sky, label: "짝꿍과 같이" }] : []),
  ];
  const legendH = legend.length ? 50 : 0;
  const inner = CARD_W - PAD * 2 - 80;
  ctx.font = font(700, 46);
  const noteH = (n: number) => (n > 0 ? 36 + 194 + 64 * n : 0);
  const rows = Math.max(1, m.weeks.length);
  const rowFor = (n: number) => Math.min(124, (1780 - top - 62 - legendH - noteH(n)) / rows);
  let lines = m.note ? wrapLines((s) => ctx.measureText(s).width, `“${m.note.body}”`, inner, 2) : [];
  if (lines.length > 1 && rowFor(lines.length) < 88) lines = wrapLines((s) => ctx.measureText(s).width, `“${m.note!.body}”`, inner, 1);
  const rowH = Math.max(88, rowFor(lines.length));
  const r = Math.min(48, rowH / 2 - 6);
  const colW = (CARD_W - PAD * 2) / 7;
  const cx = (i: number) => PAD + colW * (i + 0.5);
  ctx.textAlign = "center";
  ctx.fillStyle = C.muted;
  ctx.font = font(600, 32);
  WEEK.forEach((w, i) => ctx.fillText(w, cx(i), top + 34));
  const rowTop = top + 62;
  ctx.textBaseline = "middle";
  m.weeks.forEach((row, ri) => {
    const cy = rowTop + ri * rowH + rowH / 2;
    row.forEach((c, ci) => {
      if (!c.inMonth) return;
      const x = cx(ci);
      if (c.on) {
        // 쌍도장 — 짝꿍 도장이 살짝 뒤에 겹친다
        if (c.together) circle(ctx, x + 12, cy + 8, r, C.sky);
        circle(ctx, x, cy, r, c.gold ? C.gold : C.mint);
        ctx.fillStyle = c.gold ? C.goldInk : C.white;
        ctx.font = font(800, 40);
      } else {
        ctx.fillStyle = C.faint;
        ctx.font = font(600, 38);
      }
      ctx.fillText(String(c.num), x, cy + 2);
    });
  });
  ctx.textBaseline = "alphabetic";
  let bottom = rowTop + m.weeks.length * rowH;

  // 이름표 — 금색 · 쌍도장이 있을 때만
  if (legend.length) {
    ctx.font = font(600, 30);
    ctx.textAlign = "left";
    let lx = CARD_W - PAD;
    const ly = bottom + 34;
    for (const item of [...legend].reverse()) {
      const w = ctx.measureText(item.label).width;
      lx -= w;
      ctx.fillStyle = C.muted;
      ctx.fillText(item.label, lx, ly);
      circle(ctx, lx - 22, ly - 10, 11, item.color);
      lx -= 60;
    }
    bottom += legendH;
  }

  // ④ 코치 한마디 — 그 달 마지막 한 줄
  if (m.note && lines.length > 0) {
    const boxTop = bottom + 36;
    const boxH = 40 + 34 + 30 + lines.length * 64 + 20 + 34 + 36;
    roundRect(ctx, PAD, boxTop, CARD_W - PAD * 2, boxH, 36);
    ctx.fillStyle = C.soft;
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = C.mint;
    ctx.font = font(700, 32);
    ctx.fillText("코치님 한마디", PAD + 40, boxTop + 40 + 30);
    ctx.fillStyle = C.ink;
    ctx.font = font(700, 46);
    lines.forEach((ln, i) => ctx.fillText(ln, PAD + 40, boxTop + 40 + 34 + 30 + 46 + i * 64 - 10));
    ctx.fillStyle = C.muted;
    ctx.font = font(600, 32);
    ctx.fillText(`${m.note.who} · ${monthDayLabel(m.note.day)}`, PAD + 40, boxTop + boxH - 40);
  }

  // ⑤ 153 서명
  ctx.textAlign = "center";
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, 1800, CARD_W - PAD * 2, 2);
  ctx.fillStyle = C.muted;
  ctx.font = font(700, 36);
  ctx.fillText(m.sign, CARD_W / 2, 1866);
  ctx.textAlign = "left";

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("카드를 만들지 못했어요"))), "image/png"),
  );
}

const isPhone = (): boolean =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));

/** 휴대폰 공유 창으로 보낼 수 있나 (인스타 스토리 · 사진 저장 · 카카오톡) */
export function canShareImage(blob: Blob, fileName: string): boolean {
  if (!isPhone() || typeof navigator.share !== "function" || typeof navigator.canShare !== "function") return false;
  try {
    return navigator.canShare({ files: [new File([blob], fileName, { type: "image/png" })] });
  } catch {
    return false;
  }
}

/** 휴대폰은 공유 창, 그 밖은 내려받기 → "shared" | "downloaded" | "canceled" */
export async function shareOrSaveImage(blob: Blob, fileName: string, title = "153 운동 카드"): Promise<"shared" | "downloaded" | "canceled"> {
  if (canShareImage(blob, fileName)) {
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: "image/png" })], title });
      return "shared";
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return "canceled";
      /* 공유가 막힌 기기 — 내려받기로 */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return "downloaded";
}
