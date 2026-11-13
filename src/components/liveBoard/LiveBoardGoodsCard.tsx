/**
 * 153 — 라이브보드 2번 화면 오른쪽 1/3 '153 플리스 집업 사전예약' 안내 (2026-11-12 대표님)
 *   ① 「라이브 보드2 큐알있는부분 빼자 왜냐면 반대쪽 사이니지에 QR이있어서 그거 빼고 3분의1정도는 플리스 안내하자」
 *   ② 「현재 활동중도 지워주고 지금은 너무 조금만 사용하는거같은데 런칭이벤트를 3분의2를 사용하고 153집업을 나머지 사용해줘」
 *
 *   · 2번 화면은 오른쪽 패널(QR 출석 · 현재 활동 중 · 짐 레이드) 대신 이 패널 하나가 화면 너비 1/3 을 쓴다 — 런칭 이벤트 칸이 나머지 2/3.
 *     QR 은 옆 사이니지(번호 없는 기본 화면)에 그대로 있다.
 *   · 사전예약이 열려 있을 때만(goods_campaign_info — anon). 마감이 지나거나 서버에 닿지 않으면 그리지 않는다 → 런칭 이벤트 칸이 화면 전체를 쓴다.
 *   · 흰색 · 진회색 인쇄 모델 컷을 나란히, 글은 멀리서도 읽히게 크게 — 가격 · 인쇄 색 · 사이즈 · 마감 · 결제 · 신청하는 곳.
 *   ③ 11/12 23시 「2만5천원 … 원가 3만5천원짜리 물건인데 연말 세일로 1만원 할인해서 2만5천원 … 50장 선착순」
 *     → 정상가(있을 때만) 줄 긋고 25,000원 · 원가 그대로 한 줄 · 선착순 남은 벌 수. 다 차면 그리지 않는다(런칭 이벤트가 화면 전체).
 *   ④ 11/13 「체육관에 사이즈별 샘플도 있어서 직접 보고 입어볼수있다고 이야기하자」 → 샘플이 있는 지점 TV 만 '샘플' 줄
 *     (hasGoodsSample — 지금 선릉역점. 다른 지점 TV 에는 없는 샘플을 말하지 않는다).
 */
import { useQuery } from "@tanstack/react-query";
import { GOODS_FLEECE_SLUG, ddayLabel, deadlineLabel, hasGoodsSample, isAccepting, listPriceOf, stockLabel, won } from "@/lib/goodsPreorder";
import { getGoodsCampaign } from "@/services/goodsService";

const PHOTOS = [
  { src: "/goods/fleece/img/model-back.webp?v=2", label: "흰색 인쇄", dot: "#F2F2F0" },
  { src: "/goods/fleece/img/model-back-gray.webp?v=2", label: "진회색 인쇄", dot: "#63666A" },
];

const LiveBoardGoodsCard = ({ branchName }: { branchName?: string }) => {
  const { data: c } = useQuery({
    queryKey: ["goods-campaign", GOODS_FLEECE_SLUG, "tv"],
    queryFn: () => getGoodsCampaign(GOODS_FLEECE_SLUG),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
  });

  if (!c || !isAccepting(c)) return null;

  const list = listPriceOf(c);
  const stock = stockLabel(c);
  const rows: [string, string][] = [
    ...(stock ? ([["수량", stock]] as [string, string][]) : []),
    ["인쇄 색", "흰색 · 진회색 중 하나"],
    ["사이즈", c.sizes.join(" · ")],
    ...(hasGoodsSample(branchName) ? ([["샘플", "사이즈별로 입어 볼 수 있어요"]] as [string, string][]) : []),
    ["신청", `${deadlineLabel(c.closes_at)}까지`],
    ["결제", "데스크에서 카드 · 계좌이체"],
  ];

  return (
    <aside className="flex min-h-0 w-1/3 shrink-0 flex-col border-l border-gray-800/60 bg-gradient-to-b from-gray-900 via-gray-900/90 to-black px-8 pb-7 pt-6">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-emerald-400/15 px-3.5 py-1 text-xl font-black text-emerald-300">연말 원가 판매</span>
        <span className="text-xl font-black tracking-[0.2em] text-gray-500">153 GOODS</span>
        <span className="ml-auto rounded-full bg-white px-4 py-1 text-2xl font-black tabular-nums text-gray-900">{ddayLabel(c)}</span>
      </div>
      <h2 className="mt-3 text-6xl font-black leading-tight text-white">153 플리스 집업</h2>
      <p className="mt-1 text-2xl font-bold text-gray-400">공장에 남은 물량만 · 153은 원가 그대로</p>

      <div className="mt-5 grid min-h-0 flex-1 grid-cols-2 gap-4">
        {PHOTOS.map((p) => (
          <figure key={p.src} className="relative m-0 min-h-0 overflow-hidden rounded-2xl bg-[#E9E7E3]">
            <img
              src={p.src}
              alt={`153 플리스 집업 ${p.label}`}
              draggable={false}
              className="absolute inset-0 h-full w-full select-none object-cover object-top"
            />
            <figcaption className="absolute bottom-3 left-3 flex items-center gap-2 rounded-xl bg-black/75 px-3 py-1.5 text-2xl font-black text-white">
              <i className="inline-block h-5 w-5 rounded-full border border-white/40" style={{ background: p.dot }} />
              {p.label}
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          {list && <p className="text-3xl font-bold tabular-nums text-gray-500 line-through decoration-2">{won(list)}</p>}
          <p className="text-7xl font-black leading-none tabular-nums text-white">{won(c.price)}</p>
        </div>
        <div className="pb-1 text-right">
          <p className="text-2xl font-black text-emerald-300">153 이익 0원</p>
          <p className="text-2xl font-bold text-gray-400">앞뒤 인쇄 포함</p>
        </div>
      </div>

      <dl className="mt-5 space-y-2.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-4">
            <dt className="w-24 shrink-0 text-2xl font-bold text-gray-500">{k}</dt>
            <dd className="m-0 text-2xl font-black text-white">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-6 rounded-2xl bg-emerald-400/15 px-4 py-3.5 text-center text-3xl font-black text-emerald-200">
        신청은 마이복서153 앱 홈에서
      </p>
      <p className="mt-2 text-center text-xl font-bold text-gray-400">데스크에 말씀하셔도 돼요</p>
    </aside>
  );
};

export default LiveBoardGoodsCard;
