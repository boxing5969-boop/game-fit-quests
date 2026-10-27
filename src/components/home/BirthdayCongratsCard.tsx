/**
 * 🎂 홈 '오늘 생일인 동료' 카드 (2026-10-16 대표님: "생일 회원에게 다른 회원님들이 축하하는 문화를 만들자" → "진행")
 *
 * 보이는 조건 (아니면 아무것도 그리지 않는다):
 *   · 오늘 생일인 동료가 오늘 우리 지점에 운동하러 왔다 → 한 번 눌러 축하 (같은 사람에게 하루 한 번)
 *   · 오늘 내 생일이다 → 받은 축하 수와 보낸 사람
 * 보낸 축하는 받은 사람에게 알림으로 가고, 라이브보드 생일 카드에 '🎉 N'으로 쌓인다 (TV 는 1분마다 읽는다).
 * 생년월일은 화면 어디에도 나오지 않는다 — DB 가 '오늘 생일인가'만 알려 준다.
 */
import { toast } from "sonner";

import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NameBadge from "@/components/badges/NameBadge";
import birthdayCake from "@/assets/birthday/cake.webp";
import { BIRTHDAY_CONGRATS_REWARD, useSendBirthdayCongrats, useTodayBirthdays } from "@/services/birthdayService";

const BirthdayCongratsCard = () => {
  const { user, profile } = useAuth();
  const { data } = useTodayBirthdays(!!user);
  const send = useSendBirthdayCongrats();

  if (!data || (data.rows.length === 0 && !data.me)) return null;

  const myName = profile?.nickname || profile?.name || "복서";
  const recent = data.me?.recent ?? [];
  // 코치(지도진)는 보상이 없다 — 안내에서도 뺀다
  const staff = (profile as { is_staff?: boolean } | null)?.is_staff === true;

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-emerald-400/40 bg-card px-4 py-3.5 shadow-elev-1"
      aria-label="오늘 생일"
    >
      {/* 오로라 빛 — 라이브보드 생일 카드와 같은 색 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(120% 90% at 0% 0%, rgba(52,245,197,0.16), transparent 60%), radial-gradient(110% 90% at 100% 100%, rgba(167,139,250,0.18), transparent 60%), radial-gradient(80% 60% at 100% 0%, rgba(244,114,182,0.12), transparent 60%)",
        }}
      />
      <div aria-hidden className="bday-aurora-ring absolute inset-x-0 top-0 h-[3px]" />

      <div className="relative space-y-3">
        {/* 내 생일 */}
        {data.me && (
          <div className="flex items-center gap-3">
            <img src={birthdayCake} alt="" aria-hidden draggable={false} className="bday-bob h-14 w-14 shrink-0 select-none" />
            <div className="min-w-0 flex-1">
              <p className="text-label font-bold text-amber-600 dark:text-amber-300">Happy Birthday</p>
              <p className="mt-0.5 text-body font-extrabold leading-snug text-foreground">{myName}님, 생일 축하해요! 🎂</p>
              <p className="mt-0.5 text-label leading-relaxed text-muted-foreground">
                {data.me.congrats > 0 ? (
                  <>
                    오늘 받은 축하 <b className="font-black text-foreground">{data.me.congrats.toLocaleString("ko-KR")}개</b>
                    {recent.length > 0 && ` · ${recent.slice(0, 3).join(" · ")}님${data.me.congrats > 3 ? " 외" : ""}`}
                  </>
                ) : (
                  "오늘 운동하러 오시면 체육관 TV 에서도 다 같이 축하해 드려요"
                )}
              </p>
            </div>
          </div>
        )}

        {/* 오늘 생일인 동료 */}
        {data.rows.length > 0 && (
          <div>
            <div className="flex items-center gap-2.5">
              {!data.me && (
                <img src={birthdayCake} alt="" aria-hidden draggable={false} className="bday-bob h-11 w-11 shrink-0 select-none" />
              )}
              <div className="min-w-0">
                <p className="text-label font-extrabold leading-snug text-foreground">오늘 생일인 동료가 운동하러 왔어요</p>
                <p className="mt-0.5 text-label leading-relaxed text-muted-foreground">
                  {staff
                    ? "한 번 누르면 축하가 가고, 체육관 TV 생일 카드에 🎉 숫자가 올라가요"
                    : `축하를 보내면 💵 +${BIRTHDAY_CONGRATS_REWARD} 챔피언 머니 · 체육관 TV 생일 카드에 🎉 숫자가 올라가요`}
                </p>
              </div>
            </div>
            <ul className="mt-2.5 space-y-2">
              {data.rows.map((m) => {
                const busy = send.isPending && send.variables?.receiverId === m.user_id;
                return (
                  <li key={m.user_id} className="flex items-center gap-3 rounded-xl bg-background/70 px-3 py-2.5 ring-1 ring-inset ring-border">
                    <Avatar className="h-10 w-10 shrink-0">
                      {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.name} className="object-cover" />}
                      <AvatarFallback className="text-body font-black">{m.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="flex min-w-0 items-center gap-1 text-label font-bold text-foreground">
                        <span className="truncate">{m.name}</span>
                        <NameBadge league={m.league} birthday className="h-4 w-4" />
                      </p>
                      <p className="mt-0.5 text-label font-bold text-muted-foreground">
                        {m.congrats > 0 ? `🎉 축하 ${m.congrats.toLocaleString("ko-KR")}개` : "첫 축하를 보내 주세요"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={m.sent || busy}
                      onClick={() =>
                        send.mutate(
                          { receiverId: m.user_id },
                          {
                            onSuccess: (r) =>
                              toast.success(
                                r?.already
                                  ? "이미 축하했어요"
                                  : (r?.reward ?? 0) > 0
                                    ? `${m.name}님께 생일 축하를 보냈어요 🎉 · 💵 +${(r?.reward ?? 0).toLocaleString("ko-KR")} 챔피언 머니`
                                    : `${m.name}님께 생일 축하를 보냈어요 🎉`,
                              ),
                            onError: (e) => toast.error((e as Error).message),
                          },
                        )
                      }
                      className={
                        m.sent
                          ? "shrink-0 rounded-full bg-secondary px-3.5 py-2 text-label font-bold text-muted-foreground"
                          : "shrink-0 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-3.5 py-2 text-label font-black text-amber-950 shadow-sm active:scale-95 disabled:opacity-60"
                      }
                    >
                      {m.sent ? "축하했어요 ✓" : busy ? "보내는 중…" : "🎂 축하하기"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
};

export default BirthdayCongratsCard;
