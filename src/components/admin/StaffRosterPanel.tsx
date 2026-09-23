/**
 * 지도진 관리 패널 (2026-09-23) — 회원관리 "지도진" 필터에서 열린다.
 *
 * 대표님 지시: "코치진 따로 볼 수 있게, 코치진 관리할 수 있는 기능".
 *
 * 데이터 출처는 profiles.is_staff / staff_title / staff_source 하나뿐이다 (홈 라이센스 카드·라이브보드·
 * 회원 상세와 같은 기준). 출처(staff_source):
 *   · '153os'  — 153OS 직원 명단(staff_work_profiles)에서 매시 25분 자동 반영. 여기서 해제 불가 —
 *                153OS 에서 비활성 처리하면 다음 정각에 자동 해제된다.
 *   · 'manual' — 관리자가 이 화면에서 직접 지정. 여기서 해제 가능.
 * 쓰기는 RPC set_staff_designation 하나로만 한다 (프로필 UPDATE 정책은 admin 전용이라 super_admin 도
 * PostgREST 로 직접 못 바꾼다). 지정하면 이용권은 무제한(membership_end=null).
 *
 * 생성된 Supabase 타입에 is_staff/staff_title/staff_source 가 없어 select("*") 후 느슨하게 캐스팅한다.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Pencil, Search, UserMinus, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { honorTitle, staffDisplayName } from "@/lib/staffDisplay";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type StaffRow = {
  user_id: string;
  name: string | null;
  nickname: string | null;
  avatar_url: string | null;
  branch_name: string | null;
  phone_number: string | null;
  gym_reg_date: string | null;
  created_at: string;
  is_staff?: boolean | null;
  staff_title?: string | null;
  staff_source?: string | null;
};

const TITLE_PRESETS = ["코치", "지점장", "관장", "트레이너"];
const CUSTOM = "__custom__";

const maskPhone = (p?: string | null) => (p ? p.replace(/(\d{3})\d{3,4}(\d{4})/, "$1****$2") : "");
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("ko-KR") : "-");
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
/** KST 오늘 00:00 을 ISO 로 — 기기 시간대가 달라도(사이니지 UTC) 같은 하루를 본다 */
const kstTodayStartIso = () => {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  kst.setUTCHours(0, 0, 0, 0);
  return new Date(kst.getTime() - 9 * 3600 * 1000).toISOString();
};
const sourceLabel = (s?: string | null) => (s === "153os" ? "153OS 명단" : s === "manual" ? "수동 지정" : "출처 미기록");

const resolveTitle = (preset: string, custom: string) => (preset === CUSTOM ? custom.trim() : preset);

/**
 * 직함 선택기 — 컴포넌트 바깥(모듈 레벨)에 둔다.
 * 부모 안에서 정의하면 부모가 렌더될 때마다 새 컴포넌트가 되어 매 글자마다 리마운트 → 입력 포커스가 튄다
 * (회원관리 검색창이 그랬다).
 */
const TitlePicker = ({
  preset, custom, onChange, onSave, onCancel, saving,
}: { preset: string; custom: string; onChange: (p: string, c: string) => void; onSave: () => void; onCancel: () => void; saving: boolean }) => (
  <div className="mt-2 rounded-xl border border-border bg-muted/30 p-2.5">
    <p className="mb-1.5 text-[11px] font-bold text-muted-foreground">직함 (화면에는 "OOO 코치님" 처럼 님을 붙여 보입니다)</p>
    <div className="flex flex-wrap gap-1.5">
      {[...TITLE_PRESETS, CUSTOM].map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t, custom)}
          className={`rounded-full px-2.5 py-1 text-[11px] font-bold transition-all active:scale-95 ${
            preset === t ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
          }`}
        >
          {t === CUSTOM ? "직접 입력" : honorTitle(t)}
        </button>
      ))}
    </div>
    {preset === CUSTOM && (
      <Input
        value={custom}
        onChange={(e) => onChange(preset, e.target.value)}
        placeholder="예: 수석코치 (20자 이내)"
        maxLength={20}
        className="mt-2 h-9 rounded-lg text-sm"
      />
    )}
    <div className="mt-2 flex gap-1.5">
      <button
        type="button"
        disabled={saving || !resolveTitle(preset, custom)}
        onClick={onSave}
        className="flex-1 rounded-lg bg-primary py-2 text-xs font-bold text-primary-foreground transition-all active:scale-95 disabled:opacity-50"
      >
        저장
      </button>
      <button type="button" onClick={onCancel} className="rounded-lg bg-secondary px-3 py-2 text-xs font-bold text-secondary-foreground">
        취소
      </button>
    </div>
  </div>
);

interface Props {
  /** 회원관리 상단 검색창 값 — 이름·닉네임·전화번호로 좁힌다 */
  search?: string;
}

const StaffRosterPanel = ({ search = "" }: Props) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, role } = useAuth();
  const isSuperAdmin = role === "super_admin" || role === "admin";
  const branchName = profile?.branch_name || "";

  const [editing, setEditing] = useState<{ userId: string; preset: string; custom: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [addQuery, setAddQuery] = useState("");
  const [addPick, setAddPick] = useState<{ row: StaffRow; preset: string; custom: string } | null>(null);

  // ── 지도진 목록 + 오늘 출석 ──
  const { data, isLoading } = useQuery({
    queryKey: ["staff-roster", branchName, isSuperAdmin],
    queryFn: async () => {
      // .filter 로 쓴다 — 생성 타입에 is_staff 가 없어 .eq("is_staff") 는 타입 에러
      let q = supabase.from("profiles").select("*").filter("is_staff", "eq", true)
        .order("branch_name", { ascending: true }).order("name", { ascending: true });
      if (!isSuperAdmin) q = q.eq("branch_name", branchName);
      const { data: rows, error } = await q;
      if (error) throw error;
      const staff = (rows || []) as unknown as StaffRow[];
      const ids = staff.map((s) => s.user_id);
      const today = new Map<string, string>();
      if (ids.length) {
        const { data: att } = await supabase
          .from("attendance_logs").select("user_id, checked_in_at, is_duplicate")
          .in("user_id", ids).gte("checked_in_at", kstTodayStartIso()).order("checked_in_at", { ascending: true });
        (att || []).forEach((a) => {
          if (a.is_duplicate === true) return;
          if (!today.has(a.user_id)) today.set(a.user_id, a.checked_in_at);
        });
      }
      return { staff, today };
    },
  });

  const filtered = useMemo(() => {
    const list = data?.staff ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((s) =>
      (s.name ?? "").toLowerCase().includes(q) ||
      (s.nickname ?? "").toLowerCase().includes(q) ||
      (s.phone_number ?? "").includes(q),
    );
  }, [data, search]);

  const grouped = useMemo(() => {
    const m = new Map<string, StaffRow[]>();
    filtered.forEach((s) => {
      const k = s.branch_name || "지점 미지정";
      m.set(k, [...(m.get(k) ?? []), s]);
    });
    return [...m.entries()];
  }, [filtered]);

  // ── 지도진 추가 후보 검색 (이름·닉네임·전화 2글자 이상) ──
  const addQ = addQuery.trim();
  const { data: candidates, isFetching: searching } = useQuery({
    queryKey: ["staff-roster-candidates", addQ, branchName, isSuperAdmin],
    enabled: adding && addQ.length >= 2,
    queryFn: async () => {
      // PostgREST .or() 구문을 깨는 문자(쉼표·괄호·%·_)는 뺀다 — 글자·숫자·공백만 남긴다
      const like = `%${addQ.replace(/[^\p{L}\p{N}\s]/gu, "")}%`;
      let q = supabase.from("profiles").select("*")
        .or(`name.ilike.${like},nickname.ilike.${like},phone_number.ilike.${like}`)
        .order("name", { ascending: true }).limit(12);
      if (!isSuperAdmin) q = q.eq("branch_name", branchName);
      const { data: rows, error } = await q;
      if (error) throw error;
      return ((rows || []) as unknown as StaffRow[]).filter((r) => r.is_staff !== true);
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["staff-roster"] });
    queryClient.invalidateQueries({ queryKey: ["branch-members"] });
    queryClient.invalidateQueries({ queryKey: ["branch-stats"] });
    queryClient.invalidateQueries({ queryKey: ["global-admin-stats"] });
  };

  const designate = useMutation({
    mutationFn: async (v: { userId: string; isStaff: boolean; title?: string | null }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: res, error } = await (supabase.rpc as any)("set_staff_designation", {
        _user_id: v.userId, _is_staff: v.isStaff, _title: v.title ?? null,
      });
      if (error) throw error;
      return res as { ok: boolean; staff_title: string | null };
    },
    onSuccess: (res, v) => {
      toast.success(v.isStaff ? `${honorTitle(res?.staff_title)}으로 지정했습니다` : "지도진에서 해제했습니다");
      setEditing(null); setAddPick(null); setAdding(false); setAddQuery("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message || "처리 실패"),
  });

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-foreground">
          지도진 {filtered.length}명{isSuperAdmin && grouped.length > 1 ? ` · ${grouped.length}개 지점` : ""}
        </span>
        <button
          type="button"
          onClick={() => { setAdding((v) => !v); setAddPick(null); setAddQuery(""); }}
          className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-bold text-primary transition-all active:scale-95"
        >
          <UserPlus className="h-3.5 w-3.5" /> {adding ? "닫기" : "지도진 추가"}
        </button>
      </div>

      {/* 지도진 추가 */}
      {adding && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-3">
          <p className="mb-2 text-xs font-bold text-foreground">회원 계정을 지도진으로 지정</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={addQuery}
              onChange={(e) => { setAddQuery(e.target.value); setAddPick(null); }}
              placeholder="이름, 닉네임, 전화번호 (2글자 이상)"
              className="h-10 rounded-xl pl-9"
            />
          </div>
          {addQ.length >= 2 && !addPick && (
            <div className="mt-2 space-y-1.5">
              {searching && !candidates ? (
                <p className="px-1 text-[11px] text-muted-foreground">검색 중…</p>
              ) : (candidates ?? []).length === 0 ? (
                <p className="px-1 text-[11px] text-muted-foreground">일치하는 회원이 없습니다 (이미 지도진인 계정은 제외)</p>
              ) : (
                (candidates ?? []).map((c) => (
                  <button
                    key={c.user_id}
                    type="button"
                    onClick={() => setAddPick({ row: c, preset: "코치", custom: "" })}
                    className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-left transition-all active:scale-[0.99]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold text-foreground">{c.name || c.nickname}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {c.branch_name}{c.phone_number ? ` · ${maskPhone(c.phone_number)}` : ""}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))
              )}
            </div>
          )}
          {addPick && (
            <div className="mt-2 rounded-xl border border-border bg-card px-3 py-2">
              <p className="text-sm font-bold text-foreground">{addPick.row.name || addPick.row.nickname}</p>
              <p className="text-[11px] text-muted-foreground">{addPick.row.branch_name} · 지정하면 이용권이 무제한으로 바뀌고 회원 목록에서 지도진으로 분리됩니다</p>
              <TitlePicker
                preset={addPick.preset}
                custom={addPick.custom}
                onChange={(p, c) => setAddPick({ ...addPick, preset: p, custom: c })}
                onSave={() => designate.mutate({ userId: addPick.row.user_id, isStaff: true, title: resolveTitle(addPick.preset, addPick.custom) })}
                onCancel={() => setAddPick(null)}
                saving={designate.isPending}
              />
            </div>
          )}
        </div>
      )}

      {/* 목록 */}
      {isLoading ? (
        Array(3).fill(0).map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <span className="text-3xl">🥊</span>
          <p className="mt-2 text-sm text-muted-foreground">{search ? "검색 결과가 없습니다" : "등록된 지도진이 없습니다"}</p>
        </div>
      ) : (
        grouped.map(([branch, rows]) => (
          <div key={branch}>
            {isSuperAdmin && (
              <p className="mb-1.5 px-1 text-[11px] font-bold text-primary/70">{branch} · {rows.length}명</p>
            )}
            <div className="space-y-2">
              {rows.map((s) => {
                const fromOs = s.staff_source === "153os";
                const att = data?.today.get(s.user_id);
                const isEditing = editing?.userId === s.user_id;
                return (
                  <div key={s.user_id} className="rounded-2xl border border-border bg-card p-3.5 shadow-elev-1">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/manager/member/${s.user_id}`)}
                        className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-reward/15 text-base font-black text-reward"
                        aria-label="상세 보기"
                      >
                        {s.avatar_url ? <img src={s.avatar_url} alt="" className="h-11 w-11 object-cover" /> : (s.name || s.nickname || "?").slice(0, 1)}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate text-sm font-bold text-foreground">{staffDisplayName(s)}</span>
                          <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${fromOs ? "bg-reward/20 text-reward" : "bg-secondary text-secondary-foreground"}`}>
                            {sourceLabel(s.staff_source)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground">
                          {s.phone_number && <span>{maskPhone(s.phone_number)}</span>}
                          <span>등록 {fmtDate(s.gym_reg_date || s.created_at)}</span>
                          <span className={att ? "font-medium text-primary" : ""}>{att ? `오늘 출석 ${fmtTime(att)}` : "오늘 미출석"}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(isEditing ? null : {
                            userId: s.user_id,
                            preset: TITLE_PRESETS.includes((s.staff_title ?? "").trim()) ? (s.staff_title ?? "").trim() : (s.staff_title?.trim() ? CUSTOM : "코치"),
                            custom: TITLE_PRESETS.includes((s.staff_title ?? "").trim()) ? "" : (s.staff_title ?? "").trim(),
                          })}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground transition-all active:scale-95"
                          aria-label="직함 변경"
                          title="직함 변경"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={fromOs || designate.isPending}
                          onClick={() => {
                            if (!window.confirm(`${staffDisplayName(s)}을(를) 지도진에서 해제할까요?\n회원 목록으로 돌아가고 이용권은 CRM 동기화 값으로 채워집니다.`)) return;
                            designate.mutate({ userId: s.user_id, isStaff: false });
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive transition-all active:scale-95 disabled:opacity-40"
                          aria-label="지도진 해제"
                          title={fromOs ? "153OS 직원 명단에서 비활성 처리해야 해제됩니다" : "지도진 해제"}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    {isEditing && editing && (
                      <TitlePicker
                        preset={editing.preset}
                        custom={editing.custom}
                        onChange={(p, c) => setEditing({ ...editing, preset: p, custom: c })}
                        onSave={() => designate.mutate({ userId: s.user_id, isStaff: true, title: resolveTitle(editing.preset, editing.custom) })}
                        onCancel={() => setEditing(null)}
                        saving={designate.isPending}
                      />
                    )}
                    {fromOs && isEditing && (
                      <p className="mt-1.5 px-1 text-[10px] text-muted-foreground">153OS 명단 지도진도 직함은 여기서 바꿀 수 있어요 (명단 동기화는 빈 직함만 채웁니다).</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
        153OS 직원 명단은 매시 25분 자동 반영됩니다. 명단에 있는 지도진은 153OS에서 비활성 처리하면 다음 정각에 자동 해제되고,
        여기서 직접 지정한 지도진은 명단과 무관하게 유지됩니다. 지도진은 레벨·XP 없이 이름과 직함으로 표시되고 이용권은 무제한입니다.
      </p>
    </div>
  );
};

export default StaffRosterPanel;
