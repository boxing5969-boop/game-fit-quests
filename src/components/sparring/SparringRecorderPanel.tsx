/**
 * 🥊 스파링 기록 — 복싱 타이머 안 코치 · 지점장 칸 (2026-11-25 · docs/features/64-스파링-영상.md)
 *
 *   ① 오늘 출석한 회원 두 명 고르기(이름 찾기도) → 사람마다 촬영 가능 / 까닭(동의서 없음 · 영상 동의 없음 · 14세 미만 · 보호자 동의 없음)
 *   ② 「경기 시작」 → 서버가 경기 번호(<지점 코드>-<YYMMDD>-<번호>)를 만들고 타이머가 돈다. 끝나면 저절로 경기 끝.
 *   ③ 오늘 경기 — 촬영 여부 · 유튜브 링크 붙이기(자동 연결 전 손 연결) · 영상 열어 「여기서 피드백」
 *   ④ 링 녹화 노트북 열쇠 — 노트북이 이 번호와 시각으로 영상을 자른다(이름은 안 받음)
 *   서버가 권한을 본다(그 지점 코치 · 지점장 · 전체관리자). 흰 바탕 · 글씨 6단계 이름만.
 */
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Link2, Play, Search, Video } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { keepScreenOn } from "@/features/myboxer-visualization/mindAudio";
import { settingsLine, type TimerSettings } from "@/lib/boxingTimer";
import { filmBadge, filmBlockLine, hhmmOf, seqLabel } from "@/lib/sparringVideo";
import {
  SPARVID_KEY,
  attachVideo,
  createRecorderKey,
  endMatch,
  startMatch,
  useDayMatches,
  usePickList,
  type DayMatch,
  type MatchStarted,
  type PickPerson,
} from "@/services/sparringVideoService";
import SparringVideoSheet, { type SheetVideo } from "./SparringVideoSheet";

interface Props {
  s: TimerSettings;
  onSettings: () => void;
  onStartMatch: (m: MatchStarted) => void;
}

const useDebounced = (v: string, ms: number) => {
  const [d, setD] = useState(v);
  useEffect(() => {
    const t = window.setTimeout(() => setD(v), ms);
    return () => window.clearTimeout(t);
  }, [v, ms]);
  return d;
};

const MatchRow = ({ m, onOpen }: { m: DayMatch; onOpen: (v: SheetVideo) => void }) => {
  const qc = useQueryClient();
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => void qc.invalidateQueries({ queryKey: [...SPARVID_KEY, "day"] });

  const doAttach = async () => {
    if (!link.trim() || busy) return;
    setBusy(true);
    try {
      await attachVideo(m.id, link);
      toast.success(`${seqLabel(m.seq)} 영상을 붙였어요 · 두 회원님께 알림이 가요`);
      setLink("");
      setLinkOpen(false);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doEnd = async () => {
    try {
      await endMatch(m.id);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const badge =
    m.status === "cancelled"
      ? { t: "취소", c: "bg-muted text-muted-foreground" }
      : m.status === "live"
        ? { t: "진행 중", c: "bg-primary/15 text-primary" }
        : m.film_ok
          ? { t: "🎥 촬영", c: "bg-emerald-50 text-emerald-700" }
          : { t: "촬영 안 함", c: "bg-muted text-muted-foreground" };

  return (
    <li className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <span className="shrink-0 pt-0.5 text-body font-bold text-foreground">{seqLabel(m.seq)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-body font-bold text-foreground">
            {m.a_name} vs {m.b_name}
          </p>
          <p className="truncate text-micro text-muted-foreground">
            {hhmmOf(m.started_at)} · {m.rounds}라운드 · {m.match_code}
          </p>
          {!m.film_ok && m.status !== "cancelled" && m.film_block && (
            <p className="mt-0.5 text-micro text-amber-700">{filmBlockLine(m.film_block, m.a_name, m.b_name)}</p>
          )}
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-micro font-bold", badge.c)}>{badge.t}</span>
      </div>

      {m.status === "live" && (
        <button type="button" onClick={doEnd} className="mt-2 h-9 w-full rounded-xl bg-secondary text-label font-bold text-foreground">
          경기 끝으로 바꾸기
        </button>
      )}

      {m.film_ok && m.status !== "cancelled" && m.video_id && m.video_external_id && (
        <button
          type="button"
          onClick={() =>
            onOpen({
              video_id: m.video_id as string,
              provider: m.video_provider ?? "youtube",
              external_id: m.video_external_id as string,
              title: m.match_code,
              recorded_at: m.started_at,
              opponent_name: `${m.a_name} vs ${m.b_name}`,
            })
          }
          className="mt-2 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary/10 text-label font-bold text-primary active:scale-[0.99]"
        >
          <Video className="h-4 w-4" /> 영상 보고 피드백{m.comment_count > 0 ? ` · ${m.comment_count}` : ""}
        </button>
      )}

      {m.film_ok && m.status === "done" && !m.video_id && (
        linkOpen ? (
          <div className="mt-2 flex gap-2">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="유튜브 링크 붙여넣기"
              inputMode="url"
              autoFocus
              className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-label text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <button
              type="button"
              onClick={doAttach}
              disabled={!link.trim() || busy}
              className="h-10 shrink-0 rounded-xl bg-primary px-4 text-label font-bold text-primary-foreground disabled:opacity-40"
            >
              붙이기
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setLinkOpen(true)}
            className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border text-label font-bold text-muted-foreground"
          >
            <Link2 className="h-4 w-4" /> 유튜브 링크 붙이기 (자동 연결 전)
          </button>
        )
      )}
    </li>
  );
};

const RecorderKeyBox = () => {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const make = async () => {
    setBusy(true);
    try {
      const r = await createRecorderKey("링 녹화 노트북");
      setToken(r.token);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      toast.success("열쇠를 복사했어요");
    } catch {
      toast.error("복사하지 못했어요 · 길게 눌러 복사해 주세요");
    }
  };
  return (
    <div className="rounded-2xl border border-border bg-secondary/30 p-3">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-2 text-left">
        <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 text-label font-bold text-foreground">링 녹화 노트북 연결</span>
        <span className="text-micro text-muted-foreground">{open ? "접기" : "열기"}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <p className="text-label leading-relaxed text-muted-foreground">
            노트북 녹화 프로그램에 이 열쇠를 넣으면, 오늘 경기 번호와 시각을 받아 경기마다 영상을 잘라요. 회원 이름은 받지
            않아요. 촬영 안 하는 경기는 자르지 않고 원본도 지워요.
          </p>
          {token ? (
            <div className="space-y-2">
              <p className="break-all rounded-xl bg-card p-2 font-mono text-micro text-foreground">{token}</p>
              <button
                type="button"
                onClick={copy}
                className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-foreground text-label font-bold text-background"
              >
                <Copy className="h-4 w-4" /> 복사 (지금 한 번만 보여요)
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={make}
              disabled={busy}
              className="h-10 w-full rounded-xl border border-border bg-card text-label font-bold text-foreground disabled:opacity-40"
            >
              {busy ? "만드는 중…" : "열쇠 만들기"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const SparringRecorderPanel = ({ s, onSettings, onStartMatch }: Props) => {
  const [q, setQ] = useState("");
  const dq = useDebounced(q.trim(), 300);
  const [picked, setPicked] = useState<PickPerson[]>([]);
  const [busy, setBusy] = useState(false);
  const [openVideo, setOpenVideo] = useState<SheetVideo | null>(null);
  const pick = usePickList(dq, true);
  const day = useDayMatches(true);

  // 링 옆 태블릿 — 고르는 동안에도 화면이 꺼지지 않게
  useEffect(() => {
    void keepScreenOn(true);
    return () => {
      void keepScreenOn(false);
    };
  }, []);

  const people = pick.data?.people ?? [];
  const matches = useMemo(() => day.data?.matches ?? [], [day.data]);
  const nextSeq = useMemo(() => (matches.length ? Math.max(...matches.map((m) => m.seq)) + 1 : 1), [matches]);
  const filmOk = picked.length === 2 && picked.every((p) => !p.film_block);
  const roundsOk = s.rounds > 0;

  const toggle = (p: PickPerson) => {
    setPicked((cur) => {
      if (cur.some((x) => x.user_id === p.user_id)) return cur.filter((x) => x.user_id !== p.user_id);
      if (cur.length >= 2) return [cur[1], p];
      return [...cur, p];
    });
  };

  const start = async () => {
    if (picked.length !== 2 || !roundsOk || busy) return;
    setBusy(true);
    try {
      const m = await startMatch(picked[0].user_id, picked[1].user_id, s.rounds, s.roundSec, s.restSec);
      setPicked([]);
      setQ("");
      onStartMatch(m);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
        <div className="flex items-center gap-2 rounded-2xl bg-secondary/50 px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-label text-foreground">{settingsLine(s)}</p>
          <button type="button" onClick={onSettings} className="h-8 shrink-0 rounded-full bg-card px-3 text-micro font-bold text-foreground">
            라운드 설정
          </button>
        </div>
        {!roundsOk && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-label text-amber-800">
            라운드 수가 「무제한」이면 경기를 기록할 수 없어요 · 라운드 설정에서 정해 주세요
          </p>
        )}

        <div className="rounded-2xl border border-border bg-card p-3">
          <p className="mb-2 text-label font-bold text-foreground">다음 경기 {seqLabel(nextSeq)}</p>
          {picked.length === 0 ? (
            <p className="text-label text-muted-foreground">아래에서 두 명을 골라 주세요</p>
          ) : (
            <div className="space-y-1">
              {picked.map((p) => {
                const b = filmBadge(p.film_block);
                return (
                  <p key={p.user_id} className="flex items-center justify-between gap-2 text-body">
                    <span className="truncate font-bold text-foreground">{p.name}</span>
                    <span className={cn("shrink-0 text-label", b.ok ? "text-emerald-700" : "text-amber-700")}>{b.label}</span>
                  </p>
                );
              })}
              {picked.length === 2 && !filmOk && (
                <p className="pt-1 text-micro text-muted-foreground">이 경기는 촬영하지 않아요 · 노트북이 자르지 않고 원본도 지워요</p>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이름 찾기 (출석 안 찍은 회원)"
            className="h-11 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-body text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <p className="mb-2 text-label font-bold text-foreground">{dq ? `찾은 회원 ${people.length}` : `오늘 출석 ${people.length}`}</p>
          {pick.isLoading ? (
            <div className="h-20 animate-pulse rounded-2xl bg-muted" />
          ) : pick.isError ? (
            <p className="rounded-xl bg-muted p-3 text-label text-muted-foreground">{(pick.error as Error).message}</p>
          ) : people.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-3 text-center text-label text-muted-foreground">
              {dq ? "찾는 회원이 없어요" : "오늘 출석한 회원이 아직 없어요 · 이름으로 찾아 주세요"}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {people.map((p) => {
                const on = picked.some((x) => x.user_id === p.user_id);
                const b = filmBadge(p.film_block);
                return (
                  <button
                    key={p.user_id}
                    type="button"
                    onClick={() => toggle(p)}
                    aria-pressed={on}
                    className={cn(
                      "rounded-2xl border p-2.5 text-left transition-all active:scale-[0.98]",
                      on ? "border-primary bg-primary/10" : "border-border bg-card",
                    )}
                  >
                    <span className="block truncate text-body font-bold text-foreground">
                      {p.name}
                      {p.is_staff ? <span className="ml-1 text-micro font-medium text-muted-foreground">코치</span> : null}
                    </span>
                    <span className={cn("block truncate text-micro", b.ok ? "text-emerald-700" : "text-amber-700")}>
                      {b.label}
                    </span>
                    {p.checked_in_at && <span className="block text-micro text-muted-foreground">{hhmmOf(p.checked_in_at)} 출석</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-label font-bold text-foreground">오늘 경기 {matches.length}</p>
          {day.isError ? (
            <p className="rounded-xl bg-muted p-3 text-label text-muted-foreground">{(day.error as Error).message}</p>
          ) : matches.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-3 text-center text-label text-muted-foreground">
              아직 기록한 경기가 없어요
            </p>
          ) : (
            <ul className="space-y-2">
              {matches.map((m) => (
                <MatchRow key={m.id} m={m} onOpen={setOpenVideo} />
              ))}
            </ul>
          )}
        </div>

        <RecorderKeyBox />
      </div>

      <div className="border-t border-border bg-background px-5 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
        <button
          type="button"
          onClick={start}
          disabled={picked.length !== 2 || !roundsOk || busy}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-heading text-primary-foreground transition-all active:scale-[0.99] disabled:opacity-40"
        >
          <Play className="h-5 w-5 fill-current" />
          {busy ? "시작하는 중…" : picked.length === 2 ? `경기 시작 · ${filmOk ? "🎥 촬영" : "촬영 안 함"}` : "두 명을 골라 주세요"}
        </button>
      </div>

      <SparringVideoSheet video={openVideo} onClose={() => setOpenVideo(null)} />
    </div>
  );
};

export default SparringRecorderPanel;
