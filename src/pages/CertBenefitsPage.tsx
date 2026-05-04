import { useState, useEffect } from "react";
import { ChevronLeft, ArrowRight, ChevronDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import {
  heroBadges,
  cardContents,
  detailAccordions,
  faqItems,
  levelProgression,
  ultimateRewards,
} from "@/data/certBenefitsData";
import { cn } from "@/lib/utils";

const CertBenefitsPage = () => {
  const navigate = useNavigate();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;
    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());
    api.on("select", () => setCurrent(api.selectedScrollSnap()));
  }, [api]);

  return (
    // Hybrid layout:
    // - Outer surface is light (#F5F7FA) via .light-surface for
    //   readability-first info UI
    // - Premium "splash" sections (hero, carousel, master-reward)
    //   stay dark to preserve the brand punch
    <div className="light-surface min-h-screen pb-24">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card/95 px-5 py-3 backdrop-blur-md">
        <button
          onClick={() => navigate(-1)}
          aria-label="뒤로가기"
          className="flex h-9 w-9 items-center justify-center rounded-pill text-muted-foreground active:scale-95"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
          단증혜택
        </h1>
      </header>

      {/* ─── Hero splash (kept dark for brand impact) ─── */}
      <section className="bg-gradient-to-b from-[hsl(220_34%_7%)] to-[hsl(8_60%_14%)] px-5 py-10 text-center text-white">
        <h2 className="text-[26px] font-extrabold leading-tight">
          단증이 열어주는 미래
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-6 text-white/80">
          복싱단증은 실력의 증명에서 끝나지 않습니다.
          <br />
          공신력, 진로, 취업, 지도자 신뢰까지 연결됩니다.
        </p>
        <div className="mx-auto mt-6 flex max-w-xs flex-wrap justify-center gap-2">
          {heroBadges.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-pill bg-white/15 px-3 py-1.5 text-caption font-medium text-white backdrop-blur-sm"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* ─── Carousel (premium dark cards) ─── */}
      <section className="px-5 py-7">
        <div className="mb-4 text-center text-caption font-medium text-muted-foreground">
          <span className="number-font">
            {current + 1} / {count}
          </span>
        </div>

        <Carousel setApi={setApi} className="mx-auto max-w-md">
          <CarouselContent>
            {cardContents.map((card, i) => {
              const Icon = card.icon;
              return (
                <CarouselItem key={i}>
                  <Card className="overflow-hidden border-0 bg-gradient-to-br from-[hsl(220_35%_11%)] to-[hsl(220_34%_7%)] text-white shadow-elev-3">
                    <div className="p-6">
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <Badge className="border-0 bg-primary/20 text-caption text-primary">
                          <span className="number-font">
                            {i + 1}/{cardContents.length}
                          </span>
                        </Badge>
                      </div>

                      <h3 className="text-[20px] font-extrabold leading-tight whitespace-pre-line">
                        {card.title}
                      </h3>

                      <p className="mt-3 text-[15px] font-medium leading-6 text-white/90 whitespace-pre-line">
                        {card.mainCopy}
                      </p>

                      <ul className="mt-4 space-y-2">
                        {card.body.map((line, j) => (
                          <li
                            key={j}
                            className="flex gap-2 text-[14px] leading-6 text-white/70"
                          >
                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            {line}
                          </li>
                        ))}
                      </ul>

                      <div className="mt-5 rounded-xl bg-primary/10 px-4 py-3 text-center">
                        <p className="text-[15px] font-bold text-primary">
                          {card.highlight}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        className="mt-4 w-full border-white/20 bg-white/5 text-white hover:bg-white/10"
                      >
                        {card.cta}
                        <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>

        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              onClick={() => api?.scrollTo(i)}
              aria-label={`슬라이드 ${i + 1}`}
              className={cn(
                "h-2 rounded-full transition-all",
                i === current ? "w-6 bg-primary" : "w-2 bg-muted-foreground/30",
              )}
            />
          ))}
        </div>

        <div className="mt-6 text-center">
          <Button
            onClick={() => navigate("/mypage")}
            className="rounded-pill px-6"
          >
            내 현재 준비도 보기
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* ─── Roadmap (white surface, light UI) ─── */}
      <section className="px-5 py-6">
        <h3 className="text-[20px] font-extrabold text-foreground">
          마이복서153 → 단증 로드맵
        </h3>
        <p className="mt-1 text-[15px] leading-6 text-muted-foreground">
          각 리그 레벨을 마스터하면 해당 단수 심사에 도전할 수 있는 실력이
          완성됩니다.
        </p>
        <div className="mt-4 space-y-3">
          {levelProgression.map((item, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-card border border-border bg-card p-4 shadow-elev-1"
            >
              <div className="flex flex-col items-center gap-1">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-pill border-2 text-[16px] font-extrabold"
                  style={{
                    borderColor: item.color,
                    backgroundColor: `${item.color}18`,
                    color: item.color,
                  }}
                >
                  <span className="number-font">{item.danTarget}</span>
                </div>
                {i < levelProgression.length - 1 && (
                  <div className="h-full w-0.5 bg-border" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-bold text-foreground">
                    {item.rank}
                  </span>
                  <span
                    className="rounded-pill border px-2 py-0.5 text-[11px] font-bold number-font"
                    style={{
                      borderColor: `${item.color}55`,
                      color: item.color,
                    }}
                  >
                    {item.levels}
                  </span>
                </div>
                <p className="mt-1.5 text-[14px] leading-6 text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Master splash (dark premium) ─── */}
      <section className="px-5 py-6">
        <div className="rounded-hero bg-gradient-to-br from-[hsl(220_35%_11%)] to-[hsl(8_50%_12%)] p-6 text-white shadow-elev-3">
          <h3 className="text-[20px] font-extrabold">
            🏆 블랙 레벨 마스터 달성 시
          </h3>
          <p className="mt-1 text-[14px] leading-6 text-white/70">
            153 레벨업 전 과정을 완주하면 받게 되는 특별 혜택
          </p>
          <div className="mt-5 space-y-3">
            {ultimateRewards.map((reward, i) => {
              const Icon = reward.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-[15px] font-bold">{reward.title}</p>
                    <p className="text-[13px] leading-6 text-white/70">
                      {reward.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            onClick={() => navigate("/level-map")}
            className="mt-5 w-full rounded-pill"
          >
            내 레벨 확인하기
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* ─── Detail accordions (light, 56px min-height, readable) ─── */}
      <section className="px-5 py-5">
        <h3 className="mb-3 text-[20px] font-extrabold text-foreground">
          실제 가점 상세 정보
        </h3>
        <Accordion type="single" collapsible className="space-y-2.5">
          {detailAccordions.map((item, i) => (
            <AccordionItem
              key={i}
              value={`detail-${i}`}
              className={cn(
                "overflow-hidden rounded-[16px] border border-border bg-card px-4 shadow-elev-1",
                "data-[state=open]:border-primary/30",
              )}
            >
              <AccordionTrigger className="min-h-14 py-3 text-left text-[15px] font-bold text-foreground [&[data-state=open]>svg]:text-primary">
                {item.title}
              </AccordionTrigger>
              <AccordionContent className="border-t border-border pb-4 pt-3 text-[14px] leading-6 text-muted-foreground">
                {item.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* ─── FAQ ─── */}
      <section className="px-5 py-5">
        <h3 className="mb-3 text-[20px] font-extrabold text-foreground">
          자주 묻는 질문
        </h3>
        <Accordion type="single" collapsible className="space-y-2.5">
          {faqItems.map((item, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className={cn(
                "overflow-hidden rounded-[16px] border border-border bg-card px-4 shadow-elev-1",
                "data-[state=open]:border-primary/30",
              )}
            >
              <AccordionTrigger className="min-h-14 py-3 text-left text-[15px] font-semibold text-foreground [&[data-state=open]>svg]:text-primary">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="border-t border-border pb-4 pt-3 text-[14px] leading-6 text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* ─── Disclaimer ─── */}
      <section className="px-5 pb-8 pt-2">
        <div className="rounded-card border border-border bg-muted p-4">
          <p className="text-[13px] leading-6 text-muted-foreground">
            ※ 복싱단증의 실제 가점·우대 여부는 발급 단체, 단수, 모집 분야,
            기관별 최신 공고 기준에 따라 달라질 수 있습니다. 153 레벨업은 내부
            성장 시스템이며, 공식 단증 및 외부 전형 적용 여부는 별도 기준으로
            판단됩니다.
          </p>
        </div>
      </section>
    </div>
  );
};

export default CertBenefitsPage;
