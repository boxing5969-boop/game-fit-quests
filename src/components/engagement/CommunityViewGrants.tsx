/**
 * 지점장·코치 권한 켜고 끄기 — 전체관리자·관리자 화면 (2026-10-18 대표님:
 *   "본사는 지점장이나 코치에게 볼수있는 권한줄수있는 기능 만들어주고" ·
 *   "지점장이나 코치에게 내가 관리할수있는 권한을 주는 기능 넣자").
 *
 * 권한 2가지 — 둘 다 자기 지점에서만 쓴다:
 *   · 커뮤니티 모든 글 보기 — 회원 글을 공개 범위(친구만 · 나만 보기)·숨김과 상관없이 본다 (community_view_grants)
 *   · 우리 지점 목표 만들기 — 지점 목표를 열고 끝낸다 (staff_permissions 'branch_goal')
 * 켜면 받은 사람에게 알림이 간다. 끄면 기록은 남기고(끈 때·끈 사람) 바로 못 쓰게 된다.
 * 서버: list_staff_permissions · set_staff_permission (20261018130000_branch_goals_staff_perms.sql)
 * 자리: 커뮤니티 피드 맨 위 '전 지점 보기' 칸의 권한 버튼 (CommunityFeed). 파일·이름은 예전 그대로 둔다.
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import {
  STAFF_PERM_LABEL,
  STAFF_PERMS,
  listStaffPermissions,
  setStaffPermission,
  type StaffPerm,
  type StaffPermRow,
} from "@/services/branchGoalService";
import { shortBranchName } from "@/services/communityHubService";

const KEY = ["staff-permissions"] as const;
type StaffList = { staff: StaffPermRow[] };

const sinceText = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });

const sinceOf = (s: StaffPermRow, perm: StaffPerm) => (perm === "community_view" ? s.community_view_at : s.branch_goal_at);

const CommunityViewGrants = () => {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: KEY,
    queryFn: listStaffPermissions,
    staleTime: 30_000,
  });
  const staff = useMemo(() => data?.staff ?? [], [data]);
  const groups = useMemo(() => {
    const m = new Map<string, StaffPermRow[]>();
    for (const s of staff) {
      const b = s.branch ?? "";
      m.set(b, [...(m.get(b) ?? []), s]);
    }
    return [...m.entries()];
  }, [staff]);
  const counts = useMemo(
    () => ({
      community_view: staff.filter((s) => s.community_view).length,
      branch_goal: staff.filter((s) => s.branch_goal).length,
    }),
    [staff],
  );

  const toggle = useMutation({
    mutationFn: ({ s, perm, on }: { s: StaffPermRow; perm: StaffPerm; on: boolean }) => setStaffPermission(s.user_id, perm, on),
    onMutate: async ({ s, perm, on }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<StaffList>(KEY);
      qc.setQueryData<StaffList>(KEY, (old) =>
        old ? { staff: old.staff.map((x) => (x.user_id === s.user_id ? { ...x, [perm]: on } : x)) } : old,
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
      toast.error((e as Error).message);
    },
    onSuccess: (_d, { s, perm, on }) =>
      toast.success(
        on
          ? `${s.name} ${s.title}님에게 '${STAFF_PERM_LABEL[perm]}' 권한을 줬어요`
          : `${s.name} ${s.title}님의 '${STAFF_PERM_LABEL[perm]}' 권한을 껐어요`,
      ),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return (
    <div id="community-view-grants" className="mt-2.5 rounded-xl border border-border bg-card p-3">
      <p className="text-label font-black text-foreground">지점장·코치 권한</p>
      <ul className="mt-1 space-y-0.5 text-label leading-relaxed text-muted-foreground">
        <li>· 커뮤니티 모든 글 보기 — 친구만 · 나만 보기 · 숨긴 글까지 봐요</li>
        <li>· 우리 지점 목표 만들기 — 지점 목표를 열고 끝내요</li>
      </ul>
      <p className="mt-1 text-label leading-relaxed text-muted-foreground">
        자기 지점에서만 쓰고, 켜면 받은 사람에게 알림이 가요.
      </p>

      {isLoading ? (
        <p className="flex items-center justify-center gap-1.5 py-5 text-label text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중…
        </p>
      ) : isError ? (
        <div className="py-4 text-center">
          <p className="text-label font-bold text-foreground">목록을 불러오지 못했어요</p>
          <button type="button" onClick={() => refetch()} className="mt-1.5 text-label font-bold text-primary underline">
            다시 불러오기
          </button>
        </div>
      ) : staff.length === 0 ? (
        <p className="py-4 text-center text-label text-muted-foreground">등록된 지점장·코치가 없어요</p>
      ) : (
        <div className="mt-2.5 space-y-3">
          {groups.map(([branch, list]) => (
            <div key={branch || "none"}>
              <p className="mb-1 px-0.5 text-label font-bold text-muted-foreground">
                {branch ? shortBranchName(branch) : "지점 없음"} · {list.length}명
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {list.map((s) => (
                  <li key={s.user_id} className="px-2.5 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-label font-black text-muted-foreground">
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          s.name.slice(0, 1)
                        )}
                      </span>
                      <p className="min-w-0 truncate text-label font-bold text-foreground">
                        {s.name} <span className="text-label font-semibold text-muted-foreground">{s.title}</span>
                      </p>
                    </div>
                    <div className="mt-2 space-y-1.5 pl-[42px]">
                      {STAFF_PERMS.map((perm) => {
                        const on = s[perm];
                        const since = sinceOf(s, perm);
                        const busy =
                          toggle.isPending && toggle.variables?.s.user_id === s.user_id && toggle.variables?.perm === perm;
                        return (
                          <div key={perm} className="flex items-center justify-between gap-2">
                            <span className="min-w-0 text-label font-semibold leading-snug text-foreground">
                              {STAFF_PERM_LABEL[perm]}
                              {on && since && (
                                <span className="ml-1 text-label font-normal text-muted-foreground">· {sinceText(since)}부터</span>
                              )}
                            </span>
                            <Switch
                              checked={on}
                              disabled={busy}
                              onCheckedChange={(next) => toggle.mutate({ s, perm, on: next })}
                              aria-label={`${s.name} ${s.title} — ${STAFF_PERM_LABEL[perm]}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="px-0.5 text-label text-muted-foreground">
            지금 켜진 권한 — 글 보기 {counts.community_view}명 · 목표 만들기 {counts.branch_goal}명
          </p>
        </div>
      )}
    </div>
  );
};

export default CommunityViewGrants;
