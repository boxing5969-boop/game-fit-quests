/**
 * 153 QUEST v2 21단계 — 짐 레이드 상세 시트 (우리 지점 목표).
 *
 * 보호 원칙:
 *   · 공식 missions / member_progress 미수정
 *   · 기존 /challenges 21일 챌린지 무수정 — 자체 도메인
 *   · 보상은 RPC 반환값만 사용
 *   · z-[100] / role='dialog' / aria-modal='true' / useModalDismiss
 *
 * 2026-10-18 대표님: "우리지점 목표도 내가 설정할수있게 해줘 그리고 지점장이나 코치에게 내가 관리할수있는 권한을 주는 기능 넣자."
 *   · 목표 열기·끝내기 — get_branch_gym_raids(can_manage) · create_gym_raid · end_gym_raid (20261018130000_branch_goals_staff_perms.sql)
 *   · 전체관리자·관리자는 켜 둔 지점을 골라서, 지점장·코치는 '우리 지점 목표 만들기' 권한을 받으면 자기 지점에.
 *   · 목표 종류는 실제로 점수가 쌓이는 4가지만 (응원 보내기 · 오늘 운동 한 줄 · 복싱 IQ 퀴즈 정답 · 챌린지 완료).
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, X } from "lucide-react";
import { toast } from "sonner";

import { useModalDismiss } from "@/hooks/useModalDismiss";
import {
  useBranchGymRaids,
  useClaimGymRaidReward,
  useCreateGymRaid,
  useEndGymRaid,
} from "@/hooks/useGymRaid";
import { GYM_RAID_DISCLAIMER } from "@/data/gymRaidMessages";
import {
  GOAL_TITLE_EXAMPLE,
  GOAL_TYPE_LABEL,
  GOAL_TYPES,
  type GoalRaidType,
} from "@/services/branchGoalService";

import GymRaidContributionList from "./GymRaidContributionList";

interface Props {
  open: boolean;
  onClose: () => void;
}

const shortBranch = (b: string | null | undefined) => (b ?? "").replace(/^153복싱짐\s*/, "");

/** 서울 날짜 YYYY-MM-DD (+일) */
const kstDate = (plusDays = 0) =>
  new Date(Date.now() + 9 * 3_600_000 + plusDays * 86_400_000).toISOString().slice(0, 10);

/** 2026-10-18 → 10월 18일 */
const dayText = (ymd: string) => {
  const [, m, d] = ymd.split("-").map(Number);
  return m && d ? `${m}월 ${d}일` : ymd;
};

const digits = (v: string, max = 5) => v.replace(/\D/g, "").slice(0, max);

const GymRaidSheet = ({ open, onClose }: Props) => {
  useModalDismiss(open, onClose);
  // 전체관리자·관리자 — 지점 고르기 (비우면 서버 기본 지점)
  const [branchSel, setBranchSel] = useState<string | null>(null);
  const { data, isLoading, isError, refetch } = useBranchGymRaids(branchSel, open);
  const claimMut = useClaimGymRaidReward();
  const createMut = useCreateGymRaid();
  const endMut = useEndGymRaid();

  const raids = data?.raids ?? [];
  const branch = data?.branch ?? "";
  const branches = data?.branches ?? [];
  const canManage = !!data?.can_manage;
  const today = kstDate();

  // 목표 만들기
  const [formOpen, setFormOpen] = useState(false);
  const [goalType, setGoalType] = useState<GoalRaidType>("cheer_sent");
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("100");
  const [start, setStart] = useState(() => kstDate());
  const [end, setEnd] = useState(() => kstDate(13));
  const [desc, setDesc] = useState("");
  const [gems, setGems] = useState("20");
  const [xp, setXp] = useState("100");
  const [respect, setRespect] = useState("15");
  const [confirmEnd, setConfirmEnd] = useState<string | null>(null);

  const resetForm = () => {
    setGoalType("cheer_sent");
    setTitle("");
    setTarget("100");
    setStart(kstDate());
    setEnd(kstDate(13));
    setDesc("");
    setGems("20");
    setXp("100");
    setRespect("15");
  };

  useEffect(() => {
    if (!open) {
      setFormOpen(false);
      setConfirmEnd(null);
    }
  }, [open]);

  const handleClaim = async (raidId: string) => {
    try {
      const result = await claimMut.mutateAsync(raidId);
      toast.success(result.message, {
        description: `챔피언 머니 +${result.gems_granted} (기여 ${result.contribution_count}회)`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "보상 처리 실패");
    }
  };

  const handleCreate = async () => {
    if (title.trim().length < 2) {
      toast.error("목표 이름을 2자 이상 적어 주세요");
      return;
    }
    const t = Number(target);
    if (!t) {
      toast.error("목표 숫자를 적어 주세요");
      return;
    }
    try {
      await createMut.mutateAsync({
        branch: branch || null,
        title: title.trim(),
        description: desc.trim() || null,
        raidType: goalType,
        target: t,
        start,
        end,
        rewardGems: Number(gems) || 0,
        rewardXp: Number(xp) || 0,
        rewardRespect: Number(respect) || 0,
      });
      toast.success("우리 지점 목표를 열었어요");
      resetForm();
      setFormOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "목표를 열지 못했어요");
    }
  };

  const handleEnd = async (raidId: string) => {
    try {
      await endMut.mutateAsync(raidId);
      toast.success("목표를 끝냈어요");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "목표를 끝내지 못했어요");
    } finally {
      setConfirmEnd(null);
    }
  };

  const chip = (active: boolean) =>
    `rounded-pill border px-2.5 py-1.5 text-[11.5px] font-bold transition-colors ${
      active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"
    }`;
  const field =
    "w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none";

  const renderForm = () => {
    if (!canManage) return null;
    if (!formOpen) {
      return (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="w-full rounded-xl border border-border bg-muted/20 py-3 text-[13px] font-black text-primary active:scale-[0.99]"
        >
          + 목표 만들기
        </button>
      );
    }
    return (
      <div className="rounded-card border border-border bg-muted/20 p-4">
        <p className="text-[12.5px] font-black text-foreground">
          {shortBranch(branch) ? `${shortBranch(branch)} 목표 만들기` : "목표 만들기"}
        </p>

        <p className="mt-3 text-[11px] font-bold text-muted-foreground">무엇으로 점수를 쌓을까요?</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {GOAL_TYPES.map((k) => (
            <button key={k} type="button" onClick={() => setGoalType(k)} className={chip(goalType === k)} aria-pressed={goalType === k}>
              {GOAL_TYPE_LABEL[k]}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[10.5px] text-muted-foreground">{GOAL_TYPE_LABEL[goalType]} 한 번에 1점이에요.</p>

        <p className="mt-3 text-[11px] font-bold text-muted-foreground">목표 이름</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 40))}
          placeholder={GOAL_TITLE_EXAMPLE[goalType]}
          className={`mt-1.5 ${field}`}
          aria-label="목표 이름"
        />

        <p className="mt-3 text-[11px] font-bold text-muted-foreground">지점이 함께 채울 점수</p>
        <div className="mt-1.5 flex items-center gap-2">
          <input
            value={target}
            onChange={(e) => setTarget(digits(e.target.value))}
            inputMode="numeric"
            className={`${field} w-32`}
            aria-label="목표 점수"
          />
          <span className="text-[12.5px] font-bold text-foreground">점</span>
        </div>

        <p className="mt-3 text-[11px] font-bold text-muted-foreground">기간</p>
        <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
          <input
            type="date"
            value={start}
            min={today}
            onChange={(e) => setStart(e.target.value)}
            className={`${field} min-w-0 px-2`}
            aria-label="시작하는 날"
          />
          <span className="text-[12px] text-muted-foreground">~</span>
          <input
            type="date"
            value={end}
            min={start || today}
            onChange={(e) => setEnd(e.target.value)}
            className={`${field} min-w-0 px-2`}
            aria-label="끝나는 날"
          />
        </div>

        <p className="mt-3 text-[11px] font-bold text-muted-foreground">보상 — 목표를 채우면 참여한 회원 모두</p>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {(
            [
              ["챔피언 머니", gems, setGems, 3],
              ["경험치", xp, setXp, 4],
              ["리스펙트", respect, setRespect, 3],
            ] as const
          ).map(([label, value, set, max]) => (
            <label key={label} className="min-w-0">
              <span className="block truncate text-[10.5px] font-semibold text-muted-foreground">{label}</span>
              <input
                value={value}
                onChange={(e) => set(digits(e.target.value, max))}
                inputMode="numeric"
                className={`mt-1 ${field} px-2.5`}
                aria-label={`${label} 보상`}
              />
            </label>
          ))}
        </div>

        <p className="mt-3 text-[11px] font-bold text-muted-foreground">설명 (선택)</p>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value.slice(0, 300))}
          rows={2}
          placeholder={`비우면 "${GOAL_TYPE_LABEL[goalType]} 한 번에 1점이에요…" 설명이 들어가요`}
          className={`mt-1.5 resize-none ${field}`}
          aria-label="목표 설명"
        />

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="rounded-xl border border-border py-3 text-[13px] font-bold text-muted-foreground active:scale-[0.99]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={createMut.isPending}
            className="rounded-xl bg-primary py-3 text-[13px] font-black text-primary-foreground active:scale-[0.99] disabled:opacity-60"
          >
            {createMut.isPending ? "여는 중…" : "목표 열기"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] flex items-end justify-center bg-background/85 p-0 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="우리 지점 목표"
            className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-border bg-card shadow-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between border-b border-border px-5 pt-5 pb-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-pill bg-primary/15 text-primary">
                  <Flag className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    우리 지점 목표
                  </p>
                  <h2 className="mt-0.5 text-[15px] font-bold text-foreground">
                    {branch ? `${branch} 함께 깨는 목표` : "지점이 함께 깨는 목표"}
                  </h2>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                    내 오늘 운동이 우리 지점 목표에 더해져요.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="ml-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-95"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+5rem)]">
              {/* 지점 고르기 — 여러 지점을 볼 수 있는 계정만 (켜 둔 지점이 둘 이상일 때) */}
              {branches.length > 1 && (
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="지점 고르기">
                  {branches.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => {
                        setBranchSel(b);
                        setFormOpen(false);
                      }}
                      aria-pressed={b === branch}
                      className={chip(b === branch)}
                    >
                      {shortBranch(b) || b}
                    </button>
                  ))}
                </div>
              )}

              {isLoading ? (
                <p className="text-[12px] text-muted-foreground">
                  지점 목표를 불러오는 중…
                </p>
              ) : isError ? (
                <div className="rounded-card border border-border bg-background/40 p-3.5 text-center">
                  <p className="text-[12.5px] font-bold text-foreground">지점 목표를 불러오지 못했어요</p>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="mt-1.5 text-[12px] font-bold text-primary underline"
                  >
                    다시 불러오기
                  </button>
                </div>
              ) : raids.length === 0 ? (
                <div className="rounded-card border border-border bg-background/40 p-3.5">
                  <p className="text-[12.5px] leading-relaxed text-foreground">
                    지금 진행 중인 지점 목표가 없어요.
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {canManage
                      ? "아래에서 회원들과 함께 깰 목표를 열어 보세요."
                      : "코치님이 새 목표를 열면 여기에 보여요."}
                  </p>
                </div>
              ) : (
                raids.map((raid) => {
                  const notStarted = raid.status === "active" && raid.start_date > today;
                  const manageable = canManage && raid.status === "active";
                  const meta = [
                    raid.created_by_name ? `${raid.created_by_name}님이 열었어요` : null,
                    notStarted ? `${dayText(raid.start_date)}부터 세요` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <div key={raid.id} className="space-y-1.5">
                      <GymRaidContributionList
                        raid={raid}
                        onClaim={handleClaim}
                        claimPending={claimMut.isPending}
                      />
                      {(meta || manageable) && (
                        <div className="flex min-h-[28px] items-center justify-between gap-2 px-1">
                          <span className="min-w-0 truncate text-[10.5px] text-muted-foreground">{meta}</span>
                          {manageable &&
                            (confirmEnd === raid.id ? (
                              <span className="flex shrink-0 items-center gap-1.5">
                                <span className="text-[11px] font-bold text-foreground">끝낼까요?</span>
                                <button
                                  type="button"
                                  onClick={() => handleEnd(raid.id)}
                                  disabled={endMut.isPending}
                                  className="rounded-pill bg-destructive px-2.5 py-1 text-[11px] font-bold text-white active:scale-95 disabled:opacity-60"
                                >
                                  끝내기
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmEnd(null)}
                                  className="rounded-pill border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground active:scale-95"
                                >
                                  취소
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmEnd(raid.id)}
                                className="shrink-0 rounded-pill border border-border px-2.5 py-1 text-[11px] font-bold text-muted-foreground active:scale-95"
                              >
                                목표 끝내기
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {!isLoading && !isError && renderForm()}

              <p className="text-[10.5px] leading-relaxed text-muted-foreground">
                ※ {GYM_RAID_DISCLAIMER}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GymRaidSheet;
