/**
 * 본사 — 지점장·코치에게 '우리 지점 글 모두 보기' 권한 켜고 끄기 (2026-10-18 대표님:
 *   "본사는 지점장이나 코치에게 볼수있는 권한줄수있는 기능 만들어주고").
 *
 * 켜진 사람은 자기 지점 회원 글을 공개 범위(친구만 · 나만 보기)·숨김과 상관없이 본다. 다른 지점 글은 안 보인다.
 * 켜면 받은 사람에게 알림이 간다. 끄면 기록은 남기고(끈 때·끈 사람) 바로 안 보이게 된다.
 * 서버: list_community_view_staff · set_community_view_grant — 본사만 (20261018110000_community_visibility_private.sql)
 * 자리: 커뮤니티 피드 맨 위 '본사 보기' 칸의 [지점장·코치 보기 권한] 버튼 (CommunityFeed).
 */
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { listCommunityViewStaff, setCommunityViewGrant, type ViewGrantStaff } from "@/services/communityFeedService";
import { shortBranchName } from "@/services/communityHubService";

const KEY = ["community-view-staff"] as const;
type StaffList = { staff: ViewGrantStaff[] };

const sinceText = (iso: string) =>
  new Date(iso).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });

const CommunityViewGrants = () => {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: KEY,
    queryFn: listCommunityViewStaff,
    staleTime: 30_000,
  });
  const staff = useMemo(() => data?.staff ?? [], [data]);
  const groups = useMemo(() => {
    const m = new Map<string, ViewGrantStaff[]>();
    for (const s of staff) {
      const b = s.branch ?? "";
      m.set(b, [...(m.get(b) ?? []), s]);
    }
    return [...m.entries()];
  }, [staff]);
  const grantedCount = staff.filter((s) => s.granted).length;

  const toggle = useMutation({
    mutationFn: ({ s, on }: { s: ViewGrantStaff; on: boolean }) => setCommunityViewGrant(s.user_id, on),
    onMutate: async ({ s, on }) => {
      await qc.cancelQueries({ queryKey: KEY });
      const prev = qc.getQueryData<StaffList>(KEY);
      qc.setQueryData<StaffList>(KEY, (old) =>
        old ? { staff: old.staff.map((x) => (x.user_id === s.user_id ? { ...x, granted: on } : x)) } : old,
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(KEY, ctx.prev);
      toast.error((e as Error).message);
    },
    onSuccess: (_d, { s, on }) =>
      toast.success(on ? `${s.name} ${s.title}님에게 보기 권한을 줬어요` : `${s.name} ${s.title}님의 보기 권한을 껐어요`),
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return (
    <div id="community-view-grants" className="mt-2.5 rounded-xl border border-border bg-card p-3">
      <p className="text-[13px] font-black text-foreground">지점장·코치 보기 권한</p>
      <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">
        켜면 그 지점장·코치는 자기 지점 회원 글을 공개 범위와 상관없이 볼 수 있어요 (친구만 · 나만 보기 · 숨긴 글). 다른 지점
        글은 안 보이고, 켜면 받은 사람에게 알림이 가요.
      </p>

      {isLoading ? (
        <p className="flex items-center justify-center gap-1.5 py-5 text-[12px] text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 불러오는 중…
        </p>
      ) : isError ? (
        <div className="py-4 text-center">
          <p className="text-[12.5px] font-bold text-foreground">목록을 불러오지 못했어요</p>
          <button type="button" onClick={() => refetch()} className="mt-1.5 text-[12px] font-bold text-primary underline">
            다시 불러오기
          </button>
        </div>
      ) : staff.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-muted-foreground">등록된 지점장·코치가 없어요</p>
      ) : (
        <div className="mt-2.5 space-y-3">
          {groups.map(([branch, list]) => (
            <div key={branch || "none"}>
              <p className="mb-1 px-0.5 text-[11px] font-bold text-muted-foreground">
                {branch ? shortBranchName(branch) : "지점 없음"} · {list.length}명
              </p>
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                {list.map((s) => {
                  const busy = toggle.isPending && toggle.variables?.s.user_id === s.user_id;
                  return (
                    <li key={s.user_id} className="flex items-center gap-2.5 px-2.5 py-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[12px] font-black text-muted-foreground">
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          s.name.slice(0, 1)
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-bold text-foreground">{s.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {s.title}
                          {s.granted && s.granted_at ? ` · ${sinceText(s.granted_at)}부터` : ""}
                        </p>
                      </div>
                      <Switch
                        checked={s.granted}
                        disabled={busy}
                        onCheckedChange={(on) => toggle.mutate({ s, on })}
                        aria-label={`${s.name} ${s.title} — 우리 지점 글 모두 보기 권한`}
                      />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <p className="px-0.5 text-[11px] text-muted-foreground">
            지금 {grantedCount > 0 ? `${grantedCount}명에게 켜져 있어요` : "아무에게도 켜져 있지 않아요"}
          </p>
        </div>
      )}
    </div>
  );
};

export default CommunityViewGrants;
