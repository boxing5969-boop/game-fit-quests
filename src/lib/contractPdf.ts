/**
 * 계약서 → PDF (2026-11-03) — 화면 밖에 A4 폭(794px)으로 그린 계약서를 그림으로 떠서(html2canvas, 누를 때만 내려받음)
 * 조항 경계에서 쪽을 나눠 JPEG → imagePdf 로 묶는다. 휴대폰이면 공유(카카오톡 · 파일에 저장), 컴퓨터면 내려받기.
 */
import { buildImagePdf, pageCuts, type PdfPageImage } from "./imagePdf";

/** A4 210 × 297mm 를 96dpi 화면 픽셀로 */
export const A4_PX = { w: 794, h: 1123 } as const;
const MARGIN = { top: 44, bottom: 60 };
/** html2canvas 1.4.1 이 글자 기준선을 잴 때 쓰는 1px gif (FontMetrics) */
const H2C_PROBE_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

const waitImages = async (root: HTMLElement) => {
  const imgs = [...root.querySelectorAll("img")];
  await Promise.all(
    imgs.map((img) =>
      img.complete && img.naturalWidth > 0
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.addEventListener("load", () => res(), { once: true });
            img.addEventListener("error", () => res(), { once: true });
            setTimeout(res, 4000);
          }),
    ),
  );
};

const toJpeg = (c: HTMLCanvasElement, q = 0.86) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("그림을 만들지 못했어요"))), "image/jpeg", q));

/** root = 화면 밖에 그린 계약서(폭 794px). 블록 표시는 [data-pdf-block] */
export async function renderContractPdf(root: HTMLElement, opts: { title: string; footer: string; scale?: number }): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas");
  try {
    await document.fonts?.ready;
  } catch {
    /* 글꼴을 못 기다려도 그린다 */
  }
  await waitImages(root);
  const scale = opts.scale ?? 2;
  const rect = root.getBoundingClientRect();
  // Tailwind 기본 'img { display: block }' 때문에 html2canvas 가 글자 기준선을 재는 1px 그림이 줄 아래로 내려가
  // 글자를 몇 px 아래에 그린다(표 칸 글자가 아래 선에 붙음). 재는 그림(html2canvas 의 1px gif)만 그리는 동안 줄 안으로.
  const fix = document.createElement("style");
  fix.textContent = `img[src="${H2C_PROBE_GIF}"]{display:inline !important}`;
  document.head.appendChild(fix);
  let canvas: HTMLCanvasElement;
  try {
    canvas = await html2canvas(root, {
      scale,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: A4_PX.w,
      width: Math.ceil(rect.width),
      height: Math.ceil(rect.height),
    });
  } finally {
    fix.remove();
  }
  const blocks = [...root.querySelectorAll<HTMLElement>("[data-pdf-block]")].map((el) => {
    const r = el.getBoundingClientRect();
    return { top: r.top - rect.top, bottom: r.bottom - rect.top };
  });
  const usable = A4_PX.h - MARGIN.top - MARGIN.bottom;
  const cuts = pageCuts(blocks, rect.height, usable);
  const pages: PdfPageImage[] = [];
  for (let i = 0; i < cuts.length; i++) {
    const [y0, y1] = cuts[i];
    const pc = document.createElement("canvas");
    pc.width = Math.round(A4_PX.w * scale);
    pc.height = Math.round(A4_PX.h * scale);
    const ctx = pc.getContext("2d");
    if (!ctx) throw new Error("그림을 만들지 못했어요");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pc.width, pc.height);
    const sy = Math.round(y0 * scale);
    const sh = Math.min(canvas.height - sy, Math.round((y1 - y0) * scale));
    if (sh > 0) ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, Math.round(MARGIN.top * scale), pc.width, sh);
    ctx.fillStyle = "#6b7280";
    ctx.font = `${Math.round(11 * scale)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText(`${opts.footer} · ${i + 1} / ${cuts.length}`, pc.width / 2, pc.height - Math.round(26 * scale));
    const blob = await toJpeg(pc);
    pages.push({ jpeg: new Uint8Array(await blob.arrayBuffer()), width: pc.width, height: pc.height });
  }
  return new Blob([buildImagePdf(pages, { title: opts.title })], { type: "application/pdf" });
}

const isPhone = () =>
  typeof navigator !== "undefined" &&
  (/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)));

/** 휴대폰은 공유(카카오톡 · 파일에 저장), 아니면 내려받기 → "shared" | "downloaded" | "canceled" */
export async function savePdf(blob: Blob, filename: string): Promise<"shared" | "downloaded" | "canceled"> {
  const file = new File([blob], filename, { type: "application/pdf" });
  if (isPhone() && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return "shared";
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return "canceled";
      // 공유가 막히면 내려받기로
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
