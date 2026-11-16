/**
 * 🛍 153 마켓 — 운영진 「상품」 칸 (주문함 MarketOrdersPanel 안)
 *
 *   모두: 상품마다 회원가 · 회원에게 보이는 가격 비교 · 점검(최저가 확인한 지 오래됨 · 최저가보다 싸지 않음).
 *   대표님 · 관리자(board.boss)만: 도매가 · 남는 돈 · 넣기 · 고치기 · 켜기 · 품절 · 「오늘 가격 그대로」.
 *     — 도매가는 서버가 대표님 · 관리자에게만 보낸다(지점장 · 코치 화면에는 칸이 없다).
 *   「인터넷 최저가보다 저렴」은 근거가 있어야 하는 말이라, 최저가를 확인한 날을 꼭 같이 넣는다(14일 지나면 회원 화면에서 내려간다).
 */
import { useMemo, useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { ProductThumb } from "@/components/market/MarketParts";
import {
  MARKET_CATEGORIES,
  categoryMeta,
  compareOf,
  compareShort,
  draftOfProduct,
  emptyProductDraft,
  marginOf,
  marginText,
  parseWon,
  priceFlags,
  productDraftError,
  productTitle,
  suggestPrice,
  won,
  type MarketBoard,
  type MarketProduct,
  type ProductDraft,
} from "@/lib/market153";
import { useMarketAdminActions } from "@/services/marketService";
import { cn } from "@/lib/utils";

const inputCls =
  "h-12 w-full rounded-xl border border-border bg-card px-3.5 text-body text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

const okNum = (n: number | null): n is number => n != null && !Number.isNaN(n);

const Field = ({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) => (
  <div>
    <label htmlFor={id} className="text-label font-bold text-foreground">
      {label}
      {hint && <span className="ml-1.5 font-medium text-muted-foreground">{hint}</span>}
    </label>
    <div className="mt-1.5">{children}</div>
  </div>
);

const Toggle = ({ on, onChange, label, line }: { on: boolean; onChange: (v: boolean) => void; label: string; line: string }) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    onClick={() => onChange(!on)}
    className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3.5 py-3 text-left"
  >
    <span className="min-w-0 flex-1">
      <span className="block text-body font-bold text-foreground">{label}</span>
      <span className="block text-label text-muted-foreground">{line}</span>
    </span>
    <span className={cn("relative h-7 w-12 shrink-0 rounded-full transition-colors", on ? "bg-primary" : "bg-muted")} aria-hidden>
      <span className={cn("absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all", on ? "left-[22px]" : "left-0.5")} />
    </span>
  </button>
);

// ── 넣기 · 고치기 창 ─────────────────────────────────────────

const ProductEditor = ({
  open,
  onOpenChange,
  initial,
  board,
  branch,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ProductDraft;
  board: MarketBoard;
  branch: string | null;
}) => {
  const { saveProduct, demo } = useMarketAdminActions(branch);
  const [d, setD] = useState<ProductDraft>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ProductDraft>(k: K, v: ProductDraft[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setError(null);
  };

  const price = parseWon(d.price);
  const cost = parseWon(d.cost);
  const listPrice = parseWon(d.listPrice);
  const comparePrice = parseWon(d.comparePrice);
  const margin = okNum(price) && okNum(cost) ? marginOf({ price, cost }) : null;
  const shownCompare = okNum(price)
    ? compareOf(
        {
          price,
          listPrice: okNum(listPrice) ? listPrice : null,
          listOn: d.listOn || null,
          comparePrice: okNum(comparePrice) ? comparePrice : null,
          compareSource: d.compareSource.trim() || null,
          compareOn: d.compareOn || null,
        },
        board.today,
        board.staleDays,
      )
    : null;
  const notLower = okNum(price) && okNum(comparePrice) && comparePrice <= price;

  const submit = async () => {
    const e = productDraftError(d);
    if (e) {
      setError(e);
      return;
    }
    try {
      await saveProduct.mutateAsync(d);
      toast.success(demo ? "저장했어요 (예시)" : "저장했어요");
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[94vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-heading">{d.id ? "상품 고치기" : "상품 넣기"}</DrawerTitle>
          <DrawerDescription className="text-label">도매가는 대표님 · 관리자에게만 보여요</DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-4">
          <section className="space-y-3" aria-label="상품">
            <div>
              <p className="text-label font-bold text-foreground">분류</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {MARKET_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-pressed={d.category === c.key}
                    onClick={() => set("category", c.key)}
                    className={cn(
                      "h-10 rounded-full px-3.5 text-label font-bold",
                      d.category === c.key ? "bg-foreground text-background" : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <Field id="mk-brand" label="브랜드">
              <input id="mk-brand" value={d.brand} maxLength={30} onChange={(e) => set("brand", e.target.value)} placeholder="예: 아디다스" className={inputCls} />
            </Field>
            <Field id="mk-name" label="상품 이름">
              <input id="mk-name" value={d.name} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder="예: 스피드 175 글러브" className={inputCls} />
            </Field>
            <Field id="mk-model" label="모델 번호" hint="선택">
              <input id="mk-model" value={d.model} maxLength={40} onChange={(e) => set("model", e.target.value)} placeholder="같은 모델끼리 가격을 견줄 때 써요" className={inputCls} />
            </Field>
            <Field id="mk-summary" label="한 줄 설명" hint="선택">
              <input id="mk-summary" value={d.summary} maxLength={140} onChange={(e) => set("summary", e.target.value)} placeholder="예: 입문 · 샌드백 · 미트" className={inputCls} />
            </Field>
            <div className="grid grid-cols-[1fr_1.6fr] gap-2">
              <Field id="mk-optlabel" label="옵션 이름">
                <input id="mk-optlabel" value={d.optionLabel} maxLength={20} onChange={(e) => set("optionLabel", e.target.value)} placeholder="온스 · 사이즈" className={inputCls} />
              </Field>
              <Field id="mk-opts" label="옵션" hint="쉼표로 나눠요">
                <input id="mk-opts" value={d.optionsText} onChange={(e) => set("optionsText", e.target.value)} placeholder="10oz, 12oz, 14oz" className={inputCls} />
              </Field>
            </div>
          </section>

          <section className="space-y-3 rounded-2xl bg-secondary/50 p-3.5" aria-label="가격">
            <Field id="mk-cost" label="도매가" hint="대표님 · 관리자만 봐요">
              <input id="mk-cost" value={d.cost} inputMode="numeric" onChange={(e) => set("cost", e.target.value)} placeholder="원" className={inputCls} />
            </Field>
            {okNum(cost) && cost > 0 && (
              <div className="flex flex-wrap items-center gap-2" aria-label="도매가에 얹어 회원가 정하기">
                <span className="text-label text-muted-foreground">회원가로</span>
                {[0, 5, 10, 15].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => set("price", String(suggestPrice(cost, pct)))}
                    className="h-9 rounded-full bg-card px-3 text-label font-bold tabular-nums text-foreground shadow-elev-1 active:scale-95"
                  >
                    {pct === 0 ? "도매가 그대로" : `+${pct}%`}
                  </button>
                ))}
              </div>
            )}
            <Field id="mk-price" label="회원가">
              <input id="mk-price" value={d.price} inputMode="numeric" onChange={(e) => set("price", e.target.value)} placeholder="원" className={inputCls} />
            </Field>
            {margin && (
              <p className={cn("text-label font-bold tabular-nums", margin.amount < 0 ? "text-destructive" : "text-muted-foreground")}>
                한 개에 {marginText(margin)}
              </p>
            )}

            <div className="grid grid-cols-[1.4fr_1fr] gap-2">
              <Field id="mk-compare" label="인터넷 최저가" hint="배송비 포함">
                <input id="mk-compare" value={d.comparePrice} inputMode="numeric" onChange={(e) => set("comparePrice", e.target.value)} placeholder="원" className={inputCls} />
              </Field>
              <Field id="mk-compare-on" label="확인한 날">
                <input id="mk-compare-on" type="date" value={d.compareOn} max={board.today} onChange={(e) => set("compareOn", e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field id="mk-compare-src" label="어디서 봤나요" hint="회원에게 보여요">
              <input id="mk-compare-src" value={d.compareSource} maxLength={40} onChange={(e) => set("compareSource", e.target.value)} placeholder="예: 네이버 쇼핑" className={inputCls} />
            </Field>
            <div className="grid grid-cols-[1.4fr_1fr] gap-2">
              <Field id="mk-list" label="공식몰 판매가">
                <input id="mk-list" value={d.listPrice} inputMode="numeric" onChange={(e) => set("listPrice", e.target.value)} placeholder="원" className={inputCls} />
              </Field>
              <Field id="mk-list-on" label="확인한 날">
                <input id="mk-list-on" type="date" value={d.listOn} max={board.today} onChange={(e) => set("listOn", e.target.value)} className={inputCls} />
              </Field>
            </div>

            <p className={cn("rounded-xl px-3 py-2.5 text-label font-bold leading-snug", notLower ? "bg-destructive/10 text-destructive" : "bg-card text-foreground")}>
              {notLower
                ? "인터넷 최저가보다 싸지 않아요 — 회원 화면에 가격 비교를 보여 주지 않아요"
                : shownCompare
                  ? `회원 화면 · ${compareShort(shownCompare)} (${shownCompare.percent}%)`
                  : "회원 화면 · 가격 비교 없이 회원가만 보여요"}
            </p>
          </section>

          <section className="space-y-3" aria-label="주문 · 표시">
            <div className="grid grid-cols-2 gap-2">
              <Field id="mk-max" label="한 번에 몇 개까지">
                <input id="mk-max" value={d.maxQty} inputMode="numeric" onChange={(e) => set("maxQty", e.target.value)} className={inputCls} />
              </Field>
              <Field id="mk-sort" label="순서" hint="작을수록 앞">
                <input id="mk-sort" value={d.sort} inputMode="numeric" onChange={(e) => set("sort", e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field id="mk-lead" label="받기까지" hint="회원에게 보여요">
              <input id="mk-lead" value={d.leadNote} maxLength={40} onChange={(e) => set("leadNote", e.target.value)} placeholder="예: 결제 뒤 3~5일" className={inputCls} />
            </Field>
            <Field id="mk-ref" label="공급처 상품 번호" hint="발주 목록에 붙어요 · 선택">
              <input id="mk-ref" value={d.supplierRef} maxLength={60} onChange={(e) => set("supplierRef", e.target.value)} className={inputCls} />
            </Field>
            <Toggle on={d.active} onChange={(v) => set("active", v)} label="회원에게 보이기" line={d.active ? "마켓에 보여요" : "지금은 숨겨 둬요"} />
            <Toggle on={d.soldOut} onChange={(v) => set("soldOut", v)} label="품절" line={d.soldOut ? "보이지만 주문은 못 해요" : "주문할 수 있어요"} />
          </section>

        </div>

        <div className="space-y-2 border-t border-border px-4 pt-3 pb-[calc(env(safe-area-inset-bottom,0px)+16px)]">
          {error && (
            <p role="alert" className="text-label font-bold text-destructive">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={saveProduct.isPending}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-primary text-body font-black text-primary-foreground active:scale-[0.98] disabled:opacity-50"
          >
            {saveProduct.isPending ? "저장하는 중" : "저장"}
          </button>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

// ── 상품 한 줄 ───────────────────────────────────────────────

const ProductRow = ({
  product,
  board,
  busy,
  onEdit,
  onPatch,
}: {
  product: MarketProduct;
  board: MarketBoard;
  busy: boolean;
  onEdit: (p: MarketProduct) => void;
  onPatch: (patch: { id: string } & Record<string, unknown>, done: string) => void;
}) => {
  const flags = priceFlags(product, board.today, board.staleDays, board.boss);
  const compare = compareOf(product, board.today, board.staleDays);
  const margin = board.boss ? marginOf(product) : null;
  const stale = flags.some((f) => f.key === "stale");
  const shown = product.active === true;

  return (
    <li className={cn("rounded-2xl border border-border bg-card p-4", !shown && "opacity-80")}>
      <div className="flex gap-3">
        <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border">
          <ProductThumb product={product} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-body font-bold leading-snug text-foreground">{productTitle(product)}</p>
          <p className="mt-0.5 text-label tabular-nums text-muted-foreground">
            {categoryMeta(product.category).label} · 회원가 <b className="font-black text-foreground">{won(product.price)}</b>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-micro font-bold", shown ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
            {shown ? "보이는 중" : "숨김"}
          </span>
          {product.soldOut && <span className="inline-flex h-6 items-center rounded-full bg-foreground px-2.5 text-micro font-bold text-background">품절</span>}
        </div>
      </div>

      <p className="mt-2.5 text-label leading-snug text-foreground">
        {compare ? `회원 화면 · ${compareShort(compare)}` : "회원 화면 · 가격 비교 없음"}
      </p>
      {margin && (
        <p className={cn("mt-0.5 text-label tabular-nums", margin.amount < 0 ? "font-bold text-destructive" : "text-muted-foreground")}>
          도매가 {won(product.cost ?? 0)} · 한 개에 {marginText(margin)}
        </p>
      )}
      {flags.length > 0 && (
        <ul className="mt-2 space-y-1">
          {flags.map((f) => (
            <li key={f.key} className={cn("text-label leading-snug", f.tone === "warn" ? "font-bold text-destructive" : "text-muted-foreground")}>
              {f.tone === "warn" ? "확인 · " : ""}
              {f.text}
            </li>
          ))}
        </ul>
      )}

      {board.boss && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="h-10 rounded-xl bg-foreground px-3.5 text-label font-black text-background active:scale-95"
          >
            고치기
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPatch({ id: product.id, active: !shown }, shown ? "숨겼어요" : "회원에게 보여요")}
            className="h-10 rounded-xl bg-secondary px-3.5 text-label font-bold text-secondary-foreground disabled:opacity-50"
          >
            {shown ? "숨기기" : "보이기"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPatch({ id: product.id, sold_out: !product.soldOut }, product.soldOut ? "품절을 풀었어요" : "품절로 바꿨어요")}
            className="h-10 rounded-xl bg-secondary px-3.5 text-label font-bold text-secondary-foreground disabled:opacity-50"
          >
            {product.soldOut ? "품절 풀기" : "품절"}
          </button>
          {stale && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                onPatch(
                  {
                    id: product.id,
                    ...(product.comparePrice != null ? { compare_on: board.today } : {}),
                    ...(product.listPrice != null ? { list_on: board.today } : {}),
                  },
                  "오늘 확인한 것으로 남겼어요",
                )
              }
              className="h-10 rounded-xl border border-primary/40 bg-primary/5 px-3.5 text-label font-bold text-primary disabled:opacity-50"
            >
              오늘 다시 봤어요 · 가격 그대로
            </button>
          )}
        </div>
      )}
    </li>
  );
};

// ── 칸 ──────────────────────────────────────────────────────

const MarketProductsAdmin = ({ board, branch }: { board: MarketBoard; branch: string | null }) => {
  const { patchProduct, demo } = useMarketAdminActions(branch);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<ProductDraft>(() => emptyProductDraft(board.today));
  const [editorKey, setEditorKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);

  const products = useMemo(
    () => [...board.products].sort((a, b) => (a.sort ?? 100) - (b.sort ?? 100) || a.name.localeCompare(b.name, "ko")),
    [board.products],
  );

  const openEditor = (d: ProductDraft) => {
    setDraft(d);
    setEditorKey((k) => k + 1);
    setEditorOpen(true);
  };

  const onPatch = async (patch: { id: string } & Record<string, unknown>, done: string) => {
    setBusyId(patch.id);
    try {
      await patchProduct.mutateAsync(patch);
      toast.success(demo ? `${done} (예시)` : done);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3">
      {board.boss ? (
        <button
          type="button"
          onClick={() => openEditor(emptyProductDraft(board.today))}
          className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-card text-body font-bold text-foreground active:scale-[0.99]"
        >
          <Plus className="h-4 w-4" /> 상품 넣기
        </button>
      ) : (
        <p className="rounded-xl bg-secondary/60 px-3.5 py-2.5 text-label leading-snug text-muted-foreground">상품과 가격은 대표님 · 관리자가 고쳐요</p>
      )}

      {products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-center">
          <p className="text-body font-bold text-foreground">아직 상품이 없어요</p>
          <p className="mt-1 text-label text-muted-foreground">{board.boss ? "「상품 넣기」로 첫 상품을 넣어 주세요" : "상품이 올라오면 여기에 보여요"}</p>
        </div>
      ) : (
        <ul className="space-y-2.5" aria-label="상품">
          {products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              board={board}
              busy={busyId === p.id}
              onEdit={(x) => openEditor(draftOfProduct(x, board.today))}
              onPatch={onPatch}
            />
          ))}
        </ul>
      )}

      {board.boss && (
        <ProductEditor key={editorKey} open={editorOpen} onOpenChange={setEditorOpen} initial={draft} board={board} branch={branch} />
      )}
    </div>
  );
};

export default MarketProductsAdmin;
