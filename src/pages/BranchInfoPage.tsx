/**
 * 🏠 우리 지점 — 소개 · 코치 · 후기 (2026-11-02 대표님 「둘 다 차례로」 · 153OS 33단계 앱 연결)
 *
 *   /branch              소개(주소 · 전화 · 운영시간 + 지점이 153OS '지점 소개 정보'에서 '앱에 보이기'를 켠 글 · 사진)
 *   /branch?tab=coaches  코치 소개(153OS '코치 소개'에서 '앱에 보이기' 켠 재직 코치만)
 *   /branch?tab=reviews  후기 — 목록(이름은 첫 글자 + ○○) · 내 후기 쓰기 · 고치기 · 지우기(회원당 지점 하나)
 * 모두 153OS 에 있다 — Edge Function os-app-content(op branch · reviews · review_save · review_delete).
 * 153OS 알림 링크 branch · coaches · reviews 가 여기로 온다.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Clock, ExternalLink, MapPin, MessageSquareQuote, Phone, Star, UserRound } from "lucide-react";
import { AppPage, PageHeader } from "@/components/ui/rankingup";
import { OsBackButton, OsChip, OsEmpty, OsErrorState, OsLoading } from "@/components/os/OsParts";
import { useDeleteOsReview, useOsBranch, useOsReviews, useSaveOsReview } from "@/services/osContentService";
import {
  REVIEW_MAX,
  branchLinks,
  hoursLines,
  mapHref,
  ratingText,
  reviewError,
  telHref,
  type OsBranchInfo,
  type OsCoach,
  type OsMyReview,
} from "@/lib/osContent";
import { dmListTime } from "@/lib/dmTime";
import { cn } from "@/lib/utils";

type Tab = "intro" | "coaches" | "reviews";
const TABS: readonly [Tab, string][] = [
  ["intro", "소개"],
  ["coaches", "코치"],
  ["reviews", "후기"],
];
const tabOf = (v: string | null): Tab => (v === "coaches" || v === "reviews" ? v : "intro");

const CARD = "rounded-2xl bg-card p-5 shadow-elev-1";

// ── 별 ─────────────────────────────────────────────────────────
function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-label={`별점 ${value}점`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn("h-4 w-4", i <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} aria-hidden />
      ))}
    </span>
  );
}

/** 길면 접기 — 처음엔 lines 줄만 */
function Clamp({ text, lines = 4, className }: { text: string; lines?: 3 | 4 | 6; className?: string }) {
  const [open, setOpen] = useState(false);
  const long = text.length > lines * 34 || text.split("\n").length > lines;
  return (
    <div className={className}>
      <p
        className={cn(
          "whitespace-pre-line break-words text-body leading-relaxed text-foreground",
          long && !open && (lines === 3 ? "line-clamp-3" : lines === 4 ? "line-clamp-4" : "line-clamp-6"),
        )}
      >
        {text}
      </p>
      {long && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1 text-label font-bold text-muted-foreground">
          {open ? "접기" : "더 보기"}
        </button>
      )}
    </div>
  );
}

// ── 소개 ───────────────────────────────────────────────────────
function InfoRow({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3 py-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1 text-body text-foreground">{children}</div>
    </li>
  );
}

function IntroTab({ info, onReviews }: { info: OsBranchInfo; onReviews: () => void }) {
  const b = info.branch;
  const intro = info.intro;
  const hours = hoursLines(b?.business_hours);
  const tel = telHref(b?.phone);
  const map = mapHref(b?.address);
  const links = branchLinks(intro?.links);
  const photos = (intro?.photos ?? []).filter((p) => !!p.url);
  const notes: [string, string | null | undefined][] = [
    ["프로그램", intro?.programs],
    ["가격 안내", intro?.price_note],
    ["주차", intro?.parking],
    ["오시는 길", intro?.directions],
  ];

  return (
    <div className="space-y-4">
      {photos.length > 0 && (
        <div className="-mx-5 flex snap-x gap-2 overflow-x-auto px-5 pb-1" aria-label="지점 사진">
          {photos.map((p, i) => (
            <figure key={`${p.url}-${i}`} className="w-[78%] shrink-0 snap-start">
              <img
                src={p.url ?? undefined}
                alt={p.caption ?? `${b?.name ?? "지점"} 사진 ${i + 1}`}
                loading="lazy"
                className="aspect-[4/3] w-full rounded-2xl bg-muted object-cover"
              />
              {p.caption && <figcaption className="mt-1 truncate px-1 text-label text-muted-foreground">{p.caption}</figcaption>}
            </figure>
          ))}
        </div>
      )}

      {intro?.intro && (
        <section className={CARD} aria-label="지점 소개">
          <Clamp text={intro.intro} lines={6} />
          {!!intro.highlights?.length && (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {intro.highlights.map((h) => (
                <li key={h} className="rounded-full bg-primary/10 px-3 py-1 text-label font-bold text-primary">
                  {h}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className={CARD} aria-label="기본 정보">
        <h2 className="text-heading font-bold text-foreground">{b?.name ?? "우리 지점"}</h2>
        <ul className="mt-1 divide-y divide-border/60">
          {b?.address && (
            <InfoRow icon={<MapPin className="h-5 w-5" />}>
              <p className="break-words">{b.address}</p>
              {map && (
                <a href={map} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-label font-bold text-primary">
                  지도에서 보기 <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              )}
            </InfoRow>
          )}
          {b?.phone && (
            <InfoRow icon={<Phone className="h-5 w-5" />}>
              {tel ? (
                <a href={tel} className="font-bold text-foreground underline-offset-2 active:underline">
                  {b.phone}
                </a>
              ) : (
                b.phone
              )}
            </InfoRow>
          )}
          {(hours.length > 0 || b?.holiday_note) && (
            <InfoRow icon={<Clock className="h-5 w-5" />}>
              {hours.map((h) => (
                <p key={h} className="tabular-nums">
                  {h}
                </p>
              ))}
              {b?.holiday_note && <p className="mt-1 whitespace-pre-line text-label text-muted-foreground">{b.holiday_note}</p>}
            </InfoRow>
          )}
        </ul>
        {b?.facility_note && <p className="mt-2 whitespace-pre-line text-label leading-relaxed text-muted-foreground">{b.facility_note}</p>}
      </section>

      {notes.some(([, v]) => !!v) && (
        <section className={CARD} aria-label="이용 안내">
          <dl className="space-y-3">
            {notes
              .filter(([, v]) => !!v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-label font-bold text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 whitespace-pre-line break-words text-body leading-relaxed text-foreground">{v}</dd>
                </div>
              ))}
          </dl>
        </section>
      )}

      <button
        type="button"
        onClick={onReviews}
        className={cn(CARD, "flex w-full items-center gap-3 text-left active:scale-[0.99]")}
      >
        <Star className="h-7 w-7 shrink-0 fill-amber-400 text-amber-400" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-title font-bold tabular-nums text-foreground">
            {info.reviews.count ? ratingText(info.reviews.avg_rating) : "후기"}
          </span>
          <span className="block text-label text-muted-foreground">
            {info.reviews.count ? `회원 후기 ${info.reviews.count.toLocaleString("ko-KR")}개` : "첫 후기를 남겨 주세요"}
          </span>
        </span>
        <span className="text-label font-bold text-primary">후기 보기 ›</span>
      </button>

      {links.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <a
              key={l.key}
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-card px-4 text-label font-bold text-foreground shadow-elev-1 active:scale-95"
            >
              {l.label} <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </a>
          ))}
        </div>
      )}

      {!info.intro && <p className="px-1 text-center text-label text-muted-foreground">지점 소개 글과 사진은 준비하고 있어요</p>}
    </div>
  );
}

// ── 코치 ───────────────────────────────────────────────────────
function CoachCard({ c }: { c: OsCoach }) {
  const [more, setMore] = useState(false);
  const hasMore = c.career.length > 0 || c.certificates.length > 0;
  return (
    <li className={CARD}>
      <div className="flex items-center gap-3.5">
        {c.photo_url ? (
          <img src={c.photo_url} alt={`${c.name} 코치님`} loading="lazy" className="h-16 w-16 shrink-0 rounded-2xl bg-muted object-cover" />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-secondary">
            <UserRound className="h-8 w-8 text-muted-foreground" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-heading font-bold text-foreground">{c.name} 코치</p>
          {c.headline && <p className="mt-0.5 line-clamp-2 text-label text-muted-foreground">{c.headline}</p>}
        </div>
      </div>
      {c.specialties.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {c.specialties.map((s) => (
            <li key={s} className="rounded-full bg-primary/10 px-3 py-1 text-label font-bold text-primary">
              {s}
            </li>
          ))}
        </ul>
      )}
      {c.intro && <Clamp text={c.intro} lines={3} className="mt-3" />}
      {hasMore && (
        <>
          {more && (
            <div className="mt-3 space-y-3 rounded-xl bg-secondary/60 p-3.5">
              {c.career.length > 0 && (
                <div>
                  <p className="text-label font-bold text-muted-foreground">경력</p>
                  <ul className="mt-1 space-y-0.5">
                    {c.career.map((x) => (
                      <li key={x} className="text-body text-foreground">· {x}</li>
                    ))}
                  </ul>
                </div>
              )}
              {c.certificates.length > 0 && (
                <div>
                  <p className="text-label font-bold text-muted-foreground">자격</p>
                  <ul className="mt-1 space-y-0.5">
                    {c.certificates.map((x) => (
                      <li key={x} className="text-body text-foreground">· {x}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <button type="button" onClick={() => setMore((v) => !v)} className="mt-2 text-label font-bold text-muted-foreground" aria-expanded={more}>
            {more ? "접기" : "경력 · 자격 보기"}
          </button>
        </>
      )}
    </li>
  );
}

function CoachesTab({ coaches }: { coaches: OsCoach[] }) {
  if (!coaches.length) {
    return (
      <OsEmpty
        icon={<UserRound className="h-7 w-7 text-muted-foreground" />}
        title="코치 소개를 준비하고 있어요"
        line="곧 우리 지점 코치님들을 소개할게요"
      />
    );
  }
  return (
    <ul className="space-y-3">
      {coaches.map((c) => (
        <CoachCard key={c.staff_id} c={c} />
      ))}
    </ul>
  );
}

// ── 후기 ───────────────────────────────────────────────────────
function ReviewForm({
  coaches,
  mine,
  initialCoach,
  onDone,
}: {
  coaches: OsCoach[];
  mine: OsMyReview | null;
  /** 고칠 때 — 전에 고른 코치님(153OS 는 이름만 돌려줘 이름으로 찾는다) */
  initialCoach: string | null;
  onDone: () => void;
}) {
  const save = useSaveOsReview();
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [body, setBody] = useState(mine?.body ?? "");
  const [coach, setCoach] = useState<string | null>(initialCoach);
  const err = reviewError(rating, body);
  const touched = rating > 0 || body.trim().length > 0;

  const submit = () => {
    if (err) {
      toast.error(err);
      return;
    }
    save.mutate(
      { rating, body: body.trim(), coach_staff_id: coach },
      {
        onSuccess: (r) => {
          toast.success(r.message ?? (mine ? "후기를 고쳤어요" : "후기를 올렸어요"));
          onDone();
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "잠시 뒤 다시 시도해 주세요"),
      },
    );
  };

  return (
    <section className={CARD} aria-label={mine ? "내 후기 고치기" : "후기 쓰기"}>
      <h2 className="text-heading font-bold text-foreground">{mine ? "내 후기 고치기" : "후기 남기기"}</h2>
      <div className="mt-3 flex gap-1" role="radiogroup" aria-label="별점">
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={rating === i}
            aria-label={`${i}점`}
            onClick={() => setRating(i)}
            className="flex h-11 w-11 items-center justify-center rounded-xl active:scale-90"
          >
            <Star className={cn("h-8 w-8", i <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35")} />
          </button>
        ))}
      </div>
      {coaches.length > 0 && (
        <div className="mt-3">
          <p className="text-label font-bold text-muted-foreground">함께한 코치님 (골라도 되고 안 골라도 돼요)</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {coaches.map((c) => (
              <button
                key={c.staff_id}
                type="button"
                aria-pressed={coach === c.staff_id}
                onClick={() => setCoach((v) => (v === c.staff_id ? null : c.staff_id))}
                className={cn(
                  "h-9 rounded-full border px-3.5 text-label font-bold transition-colors",
                  coach === c.staff_id ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground",
                )}
              >
                {c.name} 코치
              </button>
            ))}
          </div>
        </div>
      )}
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        maxLength={REVIEW_MAX}
        placeholder="수업 · 분위기 · 코치님 이야기를 적어 주세요 (5자 이상)"
        className="mt-3 w-full resize-none rounded-2xl border border-border bg-background p-4 text-body text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
      />
      <p className="mt-1 flex justify-between gap-2 text-micro text-muted-foreground">
        <span>{touched && err ? err : ""}</span>
        <span className="tabular-nums">
          {body.trim().length.toLocaleString("ko-KR")} / {REVIEW_MAX.toLocaleString("ko-KR")}
        </span>
      </p>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={onDone} className="h-12 flex-1 rounded-2xl bg-secondary text-body font-bold text-foreground active:scale-[0.98]">
          취소
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={save.isPending || !!err}
          className="h-12 flex-[2] rounded-2xl bg-primary text-body font-extrabold text-primary-foreground active:scale-[0.98] disabled:opacity-50"
        >
          {save.isPending ? "올리는 중…" : mine ? "고치기" : "올리기"}
        </button>
      </div>
      <p className="mt-2 text-center text-label text-muted-foreground">다른 회원에게는 이름 첫 글자만 보여요</p>
    </section>
  );
}

function ReviewsTab({ coaches, writeFirst }: { coaches: OsCoach[]; writeFirst: boolean }) {
  const reviews = useOsReviews();
  const del = useDeleteOsReview();
  const [editing, setEditing] = useState(writeFirst);

  if (reviews.isLoading) return <OsLoading label="후기 불러오는 중" />;
  if (reviews.isError) return <OsErrorState error={reviews.error} onRetry={() => reviews.refetch()} what="후기" />;
  const mine = reviews.data?.mine ?? null;
  const all = reviews.data?.rows ?? [];
  const rows = all.filter((r) => !r.is_mine);
  // 고른 코치: 153OS 가 보낸 id 그대로(목록에 없는 코치여도 고칠 때 지워지지 않게) — 옛 153OS 면 공개 후기 속 이름으로 (2026-11-03 검수)
  const myCoachName = all.find((r) => r.is_mine)?.coach_name ?? null;
  const initialCoach = mine && mine.coach_staff_id !== undefined
    ? mine.coach_staff_id ?? null
    : myCoachName ? coaches.find((c) => c.name === myCoachName)?.staff_id ?? null : null;

  const remove = () => {
    if (!window.confirm("내 후기를 지울까요?")) return;
    del.mutate(undefined, {
      onSuccess: (r) => toast.success(r.message ?? "후기를 지웠어요"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "잠시 뒤 다시 시도해 주세요"),
    });
  };

  return (
    <div className="space-y-4">
      {editing ? (
        <ReviewForm coaches={coaches} mine={mine} initialCoach={initialCoach} onDone={() => setEditing(false)} />
      ) : mine ? (
        <section className={cn(CARD, "border border-primary/25")} aria-label="내 후기">
          <div className="flex items-center gap-2">
            <p className="text-label font-bold text-primary">내 후기</p>
            <Stars value={mine.rating} />
            <span className="ml-auto text-micro text-muted-foreground">{dmListTime(mine.updated_at || mine.created_at)}</span>
          </div>
          {mine.hidden && (
            <p className="mt-2 rounded-xl bg-secondary px-3 py-2 text-label text-muted-foreground">운영진이 숨긴 후기예요 — 나만 볼 수 있어요</p>
          )}
          <Clamp text={mine.body} className="mt-2" />
          {mine.reply && (
            <div className="mt-3 rounded-xl bg-secondary/70 p-3.5">
              <p className="text-label font-bold text-foreground">지점 답글</p>
              <p className="mt-0.5 whitespace-pre-line break-words text-body text-foreground">{mine.reply}</p>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setEditing(true)} className="h-10 flex-1 rounded-xl bg-secondary text-label font-bold text-foreground active:scale-[0.98]">
              고치기
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={del.isPending}
              className="h-10 flex-1 rounded-xl bg-secondary text-label font-bold text-muted-foreground active:scale-[0.98] disabled:opacity-50"
            >
              지우기
            </button>
          </div>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-body font-extrabold text-primary-foreground shadow-elev-1 active:scale-[0.98]"
        >
          <Star className="h-5 w-5" aria-hidden /> 후기 남기기
        </button>
      )}

      {rows.length === 0 ? (
        !mine && (
          <OsEmpty
            icon={<MessageSquareQuote className="h-7 w-7 text-muted-foreground" />}
            title="아직 후기가 없어요"
            line="첫 후기를 남겨 주세요"
          />
        )
      ) : (
        <ul className="space-y-3" aria-label="회원 후기">
          {rows.map((r) => (
            <li key={r.id} className={CARD}>
              <div className="flex items-center gap-2">
                <span className="text-body font-bold text-foreground">{r.author}</span>
                <Stars value={r.rating} />
                <span className="ml-auto shrink-0 text-micro text-muted-foreground">{dmListTime(r.created_at)}</span>
              </div>
              {r.coach_name && (
                <div className="mt-1.5">
                  <OsChip>{r.coach_name} 코치님</OsChip>
                </div>
              )}
              <Clamp text={r.body} className="mt-2" />
              {r.reply && (
                <div className="mt-3 rounded-xl bg-secondary/70 p-3.5">
                  <p className="text-label font-bold text-foreground">지점 답글</p>
                  <p className="mt-0.5 whitespace-pre-line break-words text-body text-foreground">{r.reply}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── 화면 ───────────────────────────────────────────────────────
const BranchInfoPage = () => {
  const [params, setParams] = useSearchParams();
  const tab = tabOf(params.get("tab"));
  const branch = useOsBranch();
  const writeFirst = params.get("write") === "1";
  const name = branch.data?.branch?.name?.replace(/^153복싱짐\s*/, "") || "우리 지점";

  const setTab = (t: Tab) => {
    const next = new URLSearchParams(params);
    if (t === "intro") next.delete("tab");
    else next.set("tab", t);
    next.delete("write");
    setParams(next, { replace: true });
  };

  // 탭을 바꾸면 맨 위로
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [tab]);

  const reviewCount = branch.data?.reviews.count ?? 0;

  return (
    <AppPage header={<PageHeader title={name} sticky leftAction={<OsBackButton />} />}>
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-secondary p-1" role="tablist" aria-label="우리 지점">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "flex h-10 items-center justify-center gap-1 rounded-xl text-label font-bold transition-colors",
              tab === key ? "bg-card text-foreground shadow-elev-1" : "text-muted-foreground",
            )}
          >
            {label}
            {key === "reviews" && reviewCount > 0 && <span className="tabular-nums text-muted-foreground">{reviewCount}</span>}
          </button>
        ))}
      </div>

      {branch.isLoading ? (
        <OsLoading label="지점 정보 불러오는 중" />
      ) : branch.isError ? (
        <OsErrorState error={branch.error} onRetry={() => branch.refetch()} what="지점 소개" />
      ) : !branch.data ? null : tab === "coaches" ? (
        <CoachesTab coaches={branch.data.coaches} />
      ) : tab === "reviews" ? (
        <ReviewsTab coaches={branch.data.coaches} writeFirst={writeFirst} />
      ) : (
        <IntroTab info={branch.data} onReviews={() => setTab("reviews")} />
      )}
    </AppPage>
  );
};

export default BranchInfoPage;
