/**
 * 전략 회의실 · 영상 라이브러리 (2026-10-16)
 *   · 휴대폰 영상 올리기(비공개 저장소, 50MB) 또는 유튜브·https 링크
 *   · 오늘 프로그램 블록에 붙여서 코치님들이 보고 그대로 수업
 */
import { useEffect, useMemo, useState } from "react";
import { Film, Link2, Play, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { DmSheet } from "@/components/dm/DmParts";
import { Chip, Label, inputCls } from "@/components/strategy/StrategyComposers";
import { PersonLine } from "@/components/strategy/StrategyItemCard";
import {
  STRATEGY_VIDEO_MAX_BYTES,
  VIDEO_CATEGORY_LABEL,
  strategyTime,
  useAddVideo,
  useDeleteVideo,
  type StrategyMe,
  type StrategyVideo,
  type VideoCategory,
} from "@/services/strategyService";

const CATEGORIES = Object.keys(VIDEO_CATEGORY_LABEL) as VideoCategory[];

export const VideoLibrary = ({
  me,
  branch,
  videos,
  loading,
  onPlay,
}: {
  me: StrategyMe;
  branch: string | null;
  videos: StrategyVideo[];
  loading: boolean;
  onPlay: (v: StrategyVideo) => void;
}) => {
  const [adding, setAdding] = useState(false);
  const [cat, setCat] = useState<VideoCategory | "all">("all");
  const shown = useMemo(() => (cat === "all" ? videos : videos.filter((v) => v.category === cat)), [videos, cat]);
  const present = useMemo(() => CATEGORIES.filter((c) => videos.some((v) => v.category === c)), [videos]);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl bg-foreground text-[14.5px] font-black text-background active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" /> 드릴 영상 올리기
      </button>

      {present.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip on={cat === "all"} onClick={() => setCat("all")}>
            전체 {videos.length}
          </Chip>
          {present.map((c) => (
            <Chip key={c} on={cat === c} onClick={() => setCat(c)}>
              {VIDEO_CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </div>
      )}

      {loading ? (
        <div className="h-24 animate-pulse rounded-3xl bg-card shadow-elev-1" />
      ) : shown.length === 0 ? (
        <div className="rounded-3xl bg-card px-5 py-10 text-center shadow-elev-1">
          <Film className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-[15px] font-bold text-foreground">아직 올린 영상이 없어요</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            코치님이 직접 시범 보인 드릴 영상을 올리면
            <br />
            오늘 프로그램에 붙여서 모두가 같은 기준으로 수업해요.
          </p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {shown.map((v) => (
            <VideoRow key={v.id} v={v} canDelete={v.mine || !!me.can_direct} onPlay={() => onPlay(v)} />
          ))}
        </ul>
      )}

      <VideoAddSheet open={adding} onClose={() => setAdding(false)} branch={branch} />
    </div>
  );
};

const VideoRow = ({ v, canDelete, onPlay }: { v: StrategyVideo; canDelete: boolean; onPlay: () => void }) => {
  const del = useDeleteVideo();
  const [confirm, setConfirm] = useState(false);
  return (
    <li className="rounded-3xl bg-card p-4 shadow-elev-1">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onPlay}
          aria-label={`${v.title} 재생`}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-foreground text-background active:scale-95"
        >
          <Play className="h-6 w-6" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-black leading-snug text-foreground">{v.title}</p>
          <p className="mt-0.5 text-[12px] font-bold text-muted-foreground">
            {VIDEO_CATEGORY_LABEL[v.category] ?? v.category}
            {v.minutes ? ` · ${v.minutes}분` : ""}
            {v.equipment ? ` · ${v.equipment}` : ""}
            {v.source !== "upload" ? " · 링크" : ""}
          </p>
        </div>
        {canDelete &&
          (confirm ? (
            <span className="flex shrink-0 gap-1">
              <button type="button" onClick={() => setConfirm(false)} className="rounded-full bg-secondary px-2.5 py-1 text-[11.5px] font-bold text-muted-foreground">
                취소
              </button>
              <button
                type="button"
                onClick={() =>
                  del.mutate(v.id, {
                    onSuccess: () => toast.success("영상을 지웠어요"),
                    onError: (e) => toast.error((e as Error).message),
                  })
                }
                className="rounded-full bg-destructive px-2.5 py-1 text-[11.5px] font-black text-destructive-foreground"
              >
                지우기
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirm(true)}
              aria-label="영상 지우기"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-secondary"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ))}
      </div>
      {v.points.length > 0 && (
        <ul className="mt-2.5 space-y-1 rounded-2xl bg-secondary/60 px-3 py-2">
          {v.points.map((p, i) => (
            <li key={i} className="text-[13px] leading-relaxed text-foreground">
              <span className="mr-1 font-black text-primary">{i + 1}.</span>
              {p}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        <PersonLine name={v.uploader?.name ?? ""} title={v.uploader?.title ?? ""} time={strategyTime(v.created_at)} />
      </div>
    </li>
  );
};

const VideoAddSheet = ({ open, onClose, branch }: { open: boolean; onClose: () => void; branch: string | null }) => {
  const add = useAddVideo();
  const [mode, setMode] = useState<"file" | "link">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<VideoCategory>("drill");
  const [minutes, setMinutes] = useState("");
  const [equipment, setEquipment] = useState("");
  const [points, setPoints] = useState<string[]>(["", "", ""]);

  useEffect(() => {
    if (!open) {
      setMode("file");
      setFile(null);
      setUrl("");
      setTitle("");
      setCategory("drill");
      setMinutes("");
      setEquipment("");
      setPoints(["", "", ""]);
    }
  }, [open]);

  const tooBig = !!file && file.size > STRATEGY_VIDEO_MAX_BYTES;
  const valid = !!title.trim() && (mode === "file" ? !!file && !tooBig : /^https:\/\/\S+$/i.test(url.trim()));

  const submit = () =>
    add.mutate(
      {
        branch,
        title: title.trim(),
        category,
        minutes: minutes.trim() ? Math.max(1, Math.min(120, Math.round(Number(minutes) || 1))) : null,
        equipment: equipment.trim(),
        points,
        file: mode === "file" ? file : null,
        url: mode === "link" ? url.trim() : null,
      },
      {
        onSuccess: () => {
          toast.success("영상을 올렸어요");
          onClose();
        },
        onError: (e) => toast.error((e as Error).message),
      },
    );

  return (
    <DmSheet
      open={open}
      onClose={onClose}
      tall
      title="드릴 영상 올리기"
      subtitle="코치진만 볼 수 있어요"
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={!valid || add.isPending}
          className="flex h-12 w-full items-center justify-center rounded-2xl bg-primary text-[15px] font-black text-primary-foreground active:scale-[0.99] disabled:opacity-50"
        >
          {add.isPending ? (mode === "file" ? "영상 올리는 중… 화면을 닫지 마세요" : "저장하는 중…") : "올리기"}
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-secondary p-1">
        {(["file", "link"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "flex h-10 items-center justify-center gap-1.5 rounded-xl text-[13.5px] font-bold",
              mode === m ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
            )}
          >
            {m === "file" ? <Upload className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
            {m === "file" ? "휴대폰 영상" : "유튜브 · 링크"}
          </button>
        ))}
      </div>

      {mode === "file" ? (
        <>
          <Label hint="50MB까지 · 1080p 30초~1분 정도">영상 파일</Label>
          <label className="flex min-h-[64px] cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-border bg-background px-4 py-3">
            <Film className="h-6 w-6 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 text-[13.5px]">
              {file ? (
                <>
                  <span className="block truncate font-bold text-foreground">{file.name}</span>
                  <span className={cn("block text-[12px]", tooBig ? "font-bold text-destructive" : "text-muted-foreground")}>
                    {(file.size / 1024 / 1024).toFixed(1)}MB{tooBig ? " — 50MB가 넘어요. 유튜브 링크로 올려 주세요" : ""}
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground">눌러서 영상 고르기 · 촬영하기</span>
              )}
            </span>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setFile(f);
                if (f && !title.trim()) setTitle(f.name.replace(/\.[^.]+$/, "").slice(0, 80));
              }}
            />
          </label>
        </>
      ) : (
        <>
          <Label hint="일부 공개 영상도 돼요">영상 주소</Label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} inputMode="url" placeholder="https://youtu.be/…" className={inputCls} />
        </>
      )}

      <Label>영상 이름</Label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="예: 원·투 스텝 드릴" className={inputCls} />
      <Label>종류</Label>
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <Chip key={c} on={category === c} onClick={() => setCategory(c)}>
            {VIDEO_CATEGORY_LABEL[c]}
          </Chip>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-2 gap-2">
        <div>
          <Label>시간 (분)</Label>
          <input type="number" inputMode="numeric" min={1} max={120} value={minutes} onChange={(e) => setMinutes(e.target.value)} placeholder="예: 8" className={inputCls} />
        </div>
        <div>
          <Label>준비물</Label>
          <input value={equipment} onChange={(e) => setEquipment(e.target.value)} maxLength={80} placeholder="예: 미트, 줄넘기" className={inputCls} />
        </div>
      </div>
      <Label hint="코치님들이 수업에서 꼭 말해 줄 것">코칭 포인트</Label>
      <div className="space-y-2">
        {points.map((p, i) => (
          <input
            key={i}
            value={p}
            onChange={(e) => setPoints((ps) => ps.map((x, j) => (j === i ? e.target.value : x)))}
            maxLength={80}
            placeholder={["예: 뒷발 뒤꿈치 들기", "예: 잽 뒤에 바로 가드 복귀", "예: 스텝은 짧고 빠르게"][i]}
            className={inputCls}
          />
        ))}
      </div>
    </DmSheet>
  );
};
