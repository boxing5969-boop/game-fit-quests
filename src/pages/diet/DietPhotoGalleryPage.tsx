import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import JSZip from "jszip";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronLeft,
  Download,
  ImageOff,
  Loader2,
  Package,
  Trash2,
  X,
} from "lucide-react";

import AppPage from "@/components/ui/rankingup/AppPage";
import PageHeader from "@/components/ui/rankingup/PageHeader";
import { Button } from "@/components/ui/button";

import { useAuth } from "@/contexts/AuthContext";
import { DIET_MEAL_SLOT_LABEL } from "@/data/dietProgramData";
import {
  deleteMyDietPhoto,
  fetchMyDietPhotos,
  getDietPhotoSignedUrls,
  purgeMyOldDietPhotos,
  type DietDailyLogPhotoRow,
} from "@/services/dietService";
import { cn } from "@/lib/utils";

const WARN_DAYS = 75; // 90일 자동삭제 15일 전부터 경고
const DELETE_DAYS = 90;

interface GroupedByDate {
  date: string;
  items: DietDailyLogPhotoRow[];
}

/**
 * /diet/photos — 내가 올린 모든 식단 사진.
 *
 * - 업로드 날짜 내림차순 그룹(헤더 = YYYY-MM-DD)
 * - 신호: 75일 경과 사진은 "⚠ N일 뒤 삭제" 빨간 배지
 * - 상단 "전체 저장(ZIP)" 버튼으로 jszip 일괄 다운로드
 * - 탭하면 라이트박스 모달 — 원본 크기로 감상 + 1장 삭제 가능
 */
const DietPhotoGalleryPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<DietDailyLogPhotoRow | null>(null);
  const [zipBusy, setZipBusy] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // 갤러리 진입 시 1회 자동 청소 — 90일 초과 사진을 DB/storage 에서 정리.
  // 실패해도 UI 는 그대로 진행 (best-effort).
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const r = await purgeMyOldDietPhotos(DELETE_DAYS);
        if (cancelled) return;
        if (r.success && r.deleted > 0) {
          toast.message(`3개월 경과 사진 ${r.deleted}장을 자동 정리했어요.`);
          await qc.invalidateQueries({ queryKey: ["diet", "myPhotos"] });
        }
      } catch {
        // 조용히 무시
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, qc]);

  const photosQ = useQuery({
    queryKey: ["diet", "myPhotos", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: () => (user?.id ? fetchMyDietPhotos(user.id) : Promise.resolve([])),
  });

  const photos = useMemo(() => photosQ.data ?? [], [photosQ.data]);
  const allPaths = useMemo(() => photos.map((p) => p.storage_path), [photos]);

  // 서명된 URL 일괄 발급 — 5분 유효. 페이지 체류가 길면 재발급 필요.
  const urlsQ = useQuery({
    queryKey: ["diet", "myPhotoUrls", allPaths.length, allPaths[0] ?? ""],
    enabled: allPaths.length > 0,
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const r = await getDietPhotoSignedUrls(allPaths, 300);
      if (!r.success) throw new Error(r.error);
      return r.map;
    },
  });

  const grouped = useMemo<GroupedByDate[]>(() => {
    const map = new Map<string, DietDailyLogPhotoRow[]>();
    for (const p of photos) {
      const d = p.uploaded_at.slice(0, 10);
      const arr = map.get(d) ?? [];
      arr.push(p);
      map.set(d, arr);
    }
    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, items]) => ({ date, items }));
  }, [photos]);

  const warnCount = useMemo(
    () => photos.filter((p) => daysSince(p.uploaded_at) >= WARN_DAYS).length,
    [photos],
  );

  const handleDownloadAll = async () => {
    if (photos.length === 0) {
      toast.error("저장할 사진이 없어요.");
      return;
    }
    setZipBusy(true);
    try {
      const zip = new JSZip();
      const urlMap = urlsQ.data ?? {};
      let added = 0;
      for (const p of photos) {
        const url = urlMap[p.storage_path];
        if (!url) continue;
        try {
          const resp = await fetch(url);
          if (!resp.ok) continue;
          const blob = await resp.blob();
          const fname = buildFileName(p);
          zip.file(fname, blob);
          added++;
        } catch {
          // 한 장 실패해도 계속
        }
      }
      if (added === 0) {
        toast.error("사진을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.");
        return;
      }
      const content = await zip.generateAsync({ type: "blob" });
      triggerDownload(content, `diet-photos-${todayIso()}.zip`);
      toast.success(`${added}장을 ZIP 으로 저장했어요.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "ZIP 생성 실패");
    } finally {
      setZipBusy(false);
    }
  };

  const handleDelete = async (p: DietDailyLogPhotoRow) => {
    if (!confirm(`${p.uploaded_at.slice(0, 10)} 사진을 삭제할까요?`)) return;
    setDeleting(p.id);
    try {
      const r = await deleteMyDietPhoto({
        photoId: p.id,
        storagePath: p.storage_path,
      });
      if (!r.success) {
        toast.error(`삭제 실패: ${r.error}`);
        return;
      }
      toast.success("삭제했어요.");
      setActive(null);
      await qc.invalidateQueries({ queryKey: ["diet", "myPhotos"] });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <AppPage
      header={
        <PageHeader
          title="내 식단 사진"
          subtitle="지금까지 올린 모든 기록"
          leftAction={
            <button
              type="button"
              onClick={() => navigate("/diet")}
              className="rounded-full bg-secondary p-2 active:scale-95"
              aria-label="돌아가기"
            >
              <ChevronLeft className="h-5 w-5 text-secondary-foreground" />
            </button>
          }
          sticky
        />
      }
    >
      <div className="space-y-3 pt-2">
        {/* 상단 요약 + 전체 저장 */}
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-b from-primary/10 to-transparent p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                MY PHOTOS
              </p>
              <p className="mt-0.5 text-[16px] font-extrabold text-foreground">
                총 {photos.length}장
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {DELETE_DAYS}일이 지난 사진은 공간 확보를 위해 자동 삭제돼요.
              </p>
            </div>
            <Button
              type="button"
              disabled={zipBusy || photos.length === 0}
              onClick={handleDownloadAll}
              className={cn(
                "h-11 shrink-0 rounded-2xl px-4 font-bold",
                "bg-gradient-to-r from-primary to-primary/85 text-primary-foreground",
                "shadow-[0_4px_16px_-6px_rgba(217,54,32,0.6)]",
              )}
            >
              {zipBusy ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Package className="mr-1 h-4 w-4" />
              )}
              전체 저장
            </Button>
          </div>
        </div>

        {/* 경고 배너 */}
        {warnCount > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/5 p-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-[12px] leading-relaxed text-foreground">
              <strong className="text-destructive">{warnCount}장</strong> 이
              곧 자동 삭제됩니다 (업로드 {DELETE_DAYS}일 경과). 보관하고
              싶다면 상단 "전체 저장" 또는 개별 다운로드를 해 주세요.
            </p>
          </div>
        )}

        {/* 본문 */}
        {photosQ.isLoading ? (
          <Placeholder>사진 목록을 불러오는 중...</Placeholder>
        ) : photos.length === 0 ? (
          <Placeholder>
            <ImageOff className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            아직 업로드한 사진이 없어요. 오늘의 체크인에서 식단 사진을 올려보세요.
          </Placeholder>
        ) : (
          <div className="space-y-4">
            {grouped.map((group) => (
              <DateGroup
                key={group.date}
                group={group}
                urlMap={urlsQ.data ?? {}}
                onPick={(p) => setActive(p)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 라이트박스 */}
      {active && (
        <Lightbox
          photo={active}
          url={urlsQ.data?.[active.storage_path] ?? null}
          deleting={deleting === active.id}
          onClose={() => setActive(null)}
          onDelete={() => void handleDelete(active)}
        />
      )}
    </AppPage>
  );
};

// ──────────────────────────────────────────────────────────────────
// 조각
// ──────────────────────────────────────────────────────────────────
const DateGroup = ({
  group,
  urlMap,
  onPick,
}: {
  group: GroupedByDate;
  urlMap: Record<string, string>;
  onPick: (p: DietDailyLogPhotoRow) => void;
}) => {
  const days = daysSince(group.date);
  const willExpireIn = Math.max(0, DELETE_DAYS - days);
  const isWarning = days >= WARN_DAYS;
  return (
    <section>
      <header className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[12px] font-bold text-foreground">{group.date}</h3>
        <span
          className={cn(
            "text-[10.5px] font-bold",
            isWarning ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {isWarning
            ? `⚠ ${willExpireIn}일 뒤 삭제`
            : `${group.items.length}장`}
        </span>
      </header>
      <div className="grid grid-cols-3 gap-2">
        {group.items.map((p) => {
          const url = urlMap[p.storage_path];
          const days = daysSince(p.uploaded_at);
          const warn = days >= WARN_DAYS;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p)}
              className={cn(
                "relative aspect-square overflow-hidden rounded-xl border bg-muted text-left active:scale-[0.98]",
                warn ? "border-destructive/50" : "border-border",
              )}
            >
              {url ? (
                <img
                  src={url}
                  alt={`${p.log_date} ${p.meal_slot}`}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                </div>
              )}
              <span className="absolute bottom-1 left-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-bold text-white">
                {DIET_MEAL_SLOT_LABEL[p.meal_slot]}
              </span>
              {warn && (
                <span className="absolute right-1 top-1 rounded bg-destructive px-1 py-0.5 text-[8.5px] font-black uppercase text-destructive-foreground">
                  D-{Math.max(0, DELETE_DAYS - days)}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
};

const Lightbox = ({
  photo,
  url,
  deleting,
  onClose,
  onDelete,
}: {
  photo: DietDailyLogPhotoRow;
  url: string | null;
  deleting: boolean;
  onClose: () => void;
  onDelete: () => void;
}) => {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/90 backdrop-blur-sm">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="text-[12px]">
          <p className="font-bold">{photo.log_date}</p>
          <p className="text-white/70">
            {DIET_MEAL_SLOT_LABEL[photo.meal_slot]} · {photo.uploaded_at.slice(11, 16)}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="rounded-full bg-white/15 p-2 active:scale-95"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        {url ? (
          <img
            src={url}
            alt={`${photo.log_date} ${photo.meal_slot}`}
            className="max-h-full max-w-full rounded-lg object-contain"
          />
        ) : (
          <Loader2 className="h-6 w-6 animate-spin text-white" />
        )}
      </div>
      <div className="flex items-center gap-2 p-4">
        {url && (
          <a
            href={url}
            download={buildFileName(photo)}
            className="flex-1 rounded-2xl bg-white/10 py-3 text-center text-[13px] font-bold text-white active:scale-[0.98]"
          >
            <Download className="mr-1 inline h-4 w-4" />
            저장
          </a>
        )}
        <button
          type="button"
          disabled={deleting}
          onClick={onDelete}
          className="rounded-2xl bg-destructive/85 px-4 py-3 text-[13px] font-bold text-destructive-foreground active:scale-[0.98] disabled:opacity-60"
        >
          {deleting ? (
            <Loader2 className="inline h-4 w-4 animate-spin" />
          ) : (
            <>
              <Trash2 className="mr-1 inline h-4 w-4" />
              삭제
            </>
          )}
        </button>
      </div>
    </div>
  );
};

const Placeholder = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-2xl border border-border bg-card p-8 text-center text-[13px] leading-relaxed text-muted-foreground">
    {children}
  </div>
);

// ──────────────────────────────────────────────────────────────────
// utils
// ──────────────────────────────────────────────────────────────────
function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  const diffMs = Date.now() - then;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function buildFileName(p: DietDailyLogPhotoRow): string {
  const base = `${p.log_date}_${p.meal_slot}_${p.id.slice(0, 6)}`;
  const ext = p.storage_path.split(".").pop() ?? "jpg";
  return `${base}.${ext}`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default DietPhotoGalleryPage;
