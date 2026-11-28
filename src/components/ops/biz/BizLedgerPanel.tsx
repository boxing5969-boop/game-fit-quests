/**
 * 153운영본부 「매출」 › 사업자 가계부 (2026-11-28 대표님 「전체 메뉴에 사업자 별로 153복싱짐 칠금점 153복싱짐 선릉역점 등등
 * 사업자 가계부 내역을 만들고 따로 관리할수있는 도록 메뉴 만들어줘」 · 문서 docs/features/73-사업자-가계부.md)
 *
 *   ① 사업자 카드 — 이 달 비용(지출 − 돌려받음) · 수입 · 줄 수 · 순이익 연결 표시. 누르면 그 사업자 가계부(BizBookView).
 *   ② 사업자 추가 — 대표님만(서버 biz_book_save).
 *   주소: /office?tab=sales&view=ledger (전체 메뉴 「사업자 가계부」) · &book=<사업자>&m=YYYY-MM 은 처음 한 번만 읽고 지운다
 *   (순이익 카드의 '가계부 보기'). 사업자 화면은 휴대폰 뒤로가기로 닫힌다(useBackClose).
 */
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Link2, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { fmtMan, fmtManParts } from "@/lib/opsSales";
import { useBackClose } from "@/hooks/useBackClose";
import { useBizHome, type BizBookCard } from "@/services/bizLedgerService";
import { MonthSwitcher, kstToday, monthOf } from "../OpsParts";
import BizBookSheet from "./BizBookSheet";
import BizBookView from "./BizBookView";

const card = "rounded-2xl border border-border bg-card p-5";

const BizLedgerPanel = () => {
  const today = kstToday();
  const [params, setParams] = useSearchParams();
  const [bookId, setBookId] = useState<string | null>(() => params.get("book"));
  const [month, setMonth] = useState<string>(() => {
    const m = params.get("m");
    return m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? `${m}-01` : monthOf(today);
  });
  // 처음 한 번 읽은 book · m 은 주소에서 지운다 (뒤로가기 기록이 꼬이지 않게)
  useEffect(() => {
    if (params.has("book") || params.has("m")) {
      setParams(
        (p) => {
          p.delete("book");
          p.delete("m");
          return p;
        },
        { replace: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useBackClose(!!bookId, () => setBookId(null));

  const ym = month.slice(0, 7);
  const q = useBizHome(ym);
  const [addOpen, setAddOpen] = useState(false);

  if (bookId) {
    return (
      <BizBookView
        bookId={bookId}
        month={month}
        setMonth={setMonth}
        maxMonth={monthOf(today)}
        canAdmin={q.data?.can_add === true}
        branches={q.data?.branches ?? []}
        onBack={() => setBookId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body font-black text-foreground">사업자별 장부</p>
        <MonthSwitcher month={month} onChange={setMonth} max={monthOf(today)} />
      </div>

      {q.isLoading ? (
        <div className="space-y-3" aria-hidden>
          <div className="h-36 animate-pulse rounded-2xl bg-card" />
          <div className="h-36 animate-pulse rounded-2xl bg-card" />
        </div>
      ) : !q.data ? (
        <div className={cn(card, "text-center")}>
          <p className="text-body font-bold text-foreground">사업자 가계부를 불러오지 못했어요</p>
          <p className="mt-1 text-label text-muted-foreground">{(q.error as Error | null)?.message ?? "잠시 후 다시 시도해 주세요"}</p>
          <button
            type="button"
            onClick={() => void q.refetch()}
            className="mt-4 rounded-xl bg-secondary px-4 py-2 text-label font-bold text-foreground active:scale-95"
          >
            다시 불러오기
          </button>
        </div>
      ) : (
        <>
          {q.data.books.length === 0 ? (
            <div className={cn(card, "text-center")}>
              <p className="text-body font-bold text-foreground">아직 사업자가 없어요</p>
              <p className="mt-1 text-label text-muted-foreground">
                {q.data.can_add ? "사업자를 더하면 그 사업자 통장 · 카드 내역을 따로 모아요" : "대표님이 사업자를 더하면 여기에 보여요"}
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {q.data.books.map((b) => (
                <li key={b.id}>
                  <BookCard b={b} monthNum={Number(ym.slice(5, 7))} onOpen={() => setBookId(b.id)} />
                </li>
              ))}
            </ul>
          )}
          {q.data.can_add && (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-background text-body font-bold text-foreground active:scale-[0.99]"
            >
              <Plus className="h-5 w-5" />
              사업자 추가
            </button>
          )}
          <p className="px-1 text-label text-muted-foreground">
            비용 = 지출 − 돌려받음 · 내 통장끼리 옮긴 돈과 개인 사용은 빼요 · 급여는 일한 달로 넣어요
          </p>
        </>
      )}

      <BizBookSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        book={null}
        branches={q.data?.branches ?? []}
        canAdmin={q.data?.can_add === true}
        onSaved={(id) => setBookId(id)}
      />
    </div>
  );
};

const BookCard = ({ b, monthNum, onOpen }: { b: BizBookCard; monthNum: number; onOpen: () => void }) => {
  const cost = b.out - b.back;
  const parts = fmtManParts(cost);
  return (
    <button type="button" onClick={onOpen} className={cn(card, "block w-full text-left active:scale-[0.99]")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-heading font-black text-foreground">{b.name}</p>
          <p className="mt-0.5 truncate text-label text-muted-foreground">
            {[b.owner_name, b.kind === "corp" ? "법인" : "개인사업자"].filter(Boolean).join(" · ")}
          </p>
        </div>
        {b.costs_live && b.branch && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-micro font-bold text-primary">
            <Link2 className="h-3.5 w-3.5" />
            순이익 연결
          </span>
        )}
      </div>
      <p className="mt-4 text-label font-bold text-muted-foreground">{monthNum}월 비용</p>
      <p className="mt-0.5 whitespace-nowrap font-black tabular-nums leading-none text-foreground">
        <span className="text-title">{parts.num}</span>
        <span className="ml-0.5 text-body">{parts.unit}</span>
      </p>
      <p className="mt-2 text-label tabular-nums text-muted-foreground">
        {b.n === 0 ? "이 달 기록이 없어요" : `통장 입금 ${fmtMan(b.in)} · ${b.n}줄`}
      </p>
    </button>
  );
};

export default BizLedgerPanel;
