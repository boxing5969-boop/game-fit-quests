/**
 * 런칭 이벤트 기간 설정 카드 (설정 화면 · 관리자 전용, 2026-09-23)
 *
 * 대표님 지시: "10월 1일부터 시작. 이벤트 시작일은 앱에서 설정할 수 있게".
 * 시작일·종료일(선택)을 저장하면 사이니지 TV2 런칭 이벤트 보드와 153 챌린지 "이벤트" 탭이
 * 같은 기간으로 즉시 바뀐다 (서버 app_settings.launch_event 한 곳만 읽는다).
 * 저장은 set_app_setting RPC — super_admin·admin 만 통과, 종료일 < 시작일이면 서버가 거절.
 */
import { useEffect, useRef, useState } from "react";
import { PartyPopper, Save } from "lucide-react";
import { toast } from "sonner";

import { useLaunchEventWindow, useSetLaunchEvent } from "@/hooks/use153King";
import { launchEventLine } from "@/services/king153Service";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const LaunchEventSettingsCard = () => {
  const { data: win, isLoading } = useLaunchEventWindow();
  const save = useSetLaunchEvent();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  // 서버 값은 처음 한 번만 폼에 채운다 — 다시 읽을 때마다 채우면 비워 둔 종료일이 되살아난다(검수 발견).
  const initialized = useRef(false);
  useEffect(() => {
    if (!win || initialized.current) return;
    initialized.current = true;
    setStart(win.start_date);
    setEnd(win.end_date ?? "");
  }, [win]);

  const dirty = !!win && (start !== win.start_date || (end || null) !== (win.end_date ?? null));

  const onSave = async () => {
    if (!start) { toast.error("시작일을 정해 주세요"); return; }
    if (end && end < start) { toast.error("종료일은 시작일 이후여야 해요"); return; }
    try {
      await save.mutateAsync({ start_date: start, end_date: end || null });
      toast.success("이벤트 기간을 저장했어요. TV와 앱에 바로 반영됩니다.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    }
  };

  return (
    <div className="animate-slide-up rounded-2xl border border-border bg-card p-5 shadow-elev-1" style={{ animationDelay: "0.14s" }}>
      <h2 className="mb-1 flex items-center gap-2 text-base font-bold text-foreground">
        <PartyPopper className="h-4 w-4 text-reward" /> 153 마이복서 런칭 이벤트
      </h2>
      <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
        사이니지 TV2 보드(①출석왕 ②앱활동왕 ③닉네임좋아요왕)와 153 챌린지 "이벤트" 탭이 이 기간으로 집계돼요.
        시작 전엔 TV에 D-day 안내가, 종료 후엔 종료일까지의 기록으로 최종 결과가 보입니다.
      </p>

      <div className="mb-3 rounded-xl border border-reward/30 bg-reward/10 px-3 py-2 text-[12px] font-bold text-foreground">
        {isLoading || !win ? "기간 확인 중…" : `지금 상태 · ${launchEventLine(win)}`}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="launch-start" className="text-sm text-muted-foreground">시작일</Label>
          <Input id="launch-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-xl" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="launch-end" className="text-sm text-muted-foreground">종료일 (비우면 계속)</Label>
          <Input id="launch-end" type="date" value={end} min={start || undefined} onChange={(e) => setEnd(e.target.value)} className="rounded-xl" />
        </div>
      </div>

      <button
        type="button"
        onClick={onSave}
        disabled={save.isPending || !dirty}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground shadow-md transition-all active:scale-[0.98] disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {save.isPending ? "저장 중..." : dirty ? "이벤트 기간 저장" : "저장됨"}
      </button>
    </div>
  );
};

export default LaunchEventSettingsCard;
