import { useState, useEffect } from "react";
import { ChevronLeft, ArrowRight, CheckCircle2 } from "lucide-react";
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
import { heroBadges, cardContents, detailAccordions, faqItems, levelProgression, ultimateRewards } from "@/data/certBenefitsData";

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
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="text-muted-foreground">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="font-display text-lg font-bold">단증혜택</h1>
      </div>

      {/* Hero */}
      <section className="bg-gradient-to-b from-[hsl(14,90%,15%)] to-[hsl(14,40%,10%)] px-5 py-8 text-center text-white">
        <h2 className="font-display text-2xl font-bold leading-tight">
          단증이 열어주는 미래
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-white/80">
          복싱단증은 실력의 증명에서 끝나지 않습니다.
          <br />
          공신력, 진로, 취업, 지도자 신뢰까지 연결됩니다.
        </p>
        <div className="mx-auto mt-6 flex max-w-xs flex-wrap justify-center gap-2">
          {heroBadges.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </span>
          ))}
        </div>
      </section>

      {/* Carousel */}
      <section className="px-4 py-6">
        <div className="mb-4 text-center text-sm font-medium text-muted-foreground">
          {current + 1} / {count}
        </div>

        <Carousel setApi={setApi} className="mx-auto max-w-md">
          <CarouselContent>
            {cardContents.map((card, i) => {
              const Icon = card.icon;
              return (
                <CarouselItem key={i}>
                  <Card className="overflow-hidden border-0 bg-gradient-to-br from-[hsl(0,0%,12%)] to-[hsl(0,0%,8%)] text-white shadow-xl">
                    <div className="p-5">
                      {/* Icon & number */}
                      <div className="mb-4 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <Badge className="bg-primary/20 text-primary border-0 text-xs">
                          {i + 1}/{cardContents.length}
                        </Badge>
                      </div>

                      {/* Title */}
                      <h3 className="font-display text-xl font-bold leading-tight whitespace-pre-line">
                        {card.title}
                      </h3>

                      {/* Main copy */}
                      <p className="mt-3 text-sm font-medium leading-relaxed text-white/90 whitespace-pre-line">
                        {card.mainCopy}
                      </p>

                      {/* Body */}
                      <ul className="mt-4 space-y-2">
                        {card.body.map((line, j) => (
                          <li
                            key={j}
                            className="flex gap-2 text-[13px] leading-relaxed text-white/70"
                          >
                            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                            {line}
                          </li>
                        ))}
                      </ul>

                      {/* Highlight */}
                      <div className="mt-5 rounded-lg bg-primary/10 px-4 py-3 text-center">
                        <p className="text-sm font-bold text-primary">
                          {card.highlight}
                        </p>
                      </div>

                      {/* CTA */}
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

        {/* Dots */}
        <div className="mt-4 flex justify-center gap-2">
          {Array.from({ length: count }).map((_, i) => (
            <button
              key={i}
              onClick={() => api?.scrollTo(i)}
              className={`h-2 rounded-full transition-all ${
                i === current
                  ? "w-6 bg-primary"
                  : "w-2 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>

        {/* CTA below carousel */}
        <div className="mt-6 text-center">
          <Button
            onClick={() => navigate("/mypage")}
            className="rounded-full px-6"
          >
            내 현재 준비도 보기
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* 레벨 → 단증 로드맵 */}
      <section className="px-4 py-6">
        <h3 className="mb-2 font-display text-lg font-bold">🥊 153 레벨업 → 단증 로드맵</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          각 벨트 레벨을 마스터하면 해당 단수 심사에 도전할 수 있는 실력이 완성됩니다.
        </p>
        <div className="space-y-3">
          {levelProgression.map((item, i) => (
            <div
              key={i}
              className="flex gap-4 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex flex-col items-center gap-1">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-full border-2 font-display text-lg font-bold text-white"
                  style={{ borderColor: item.color, backgroundColor: `${item.color}20` }}
                >
                  {item.danTarget}
                </div>
                {i < levelProgression.length - 1 && (
                  <div className="h-full w-0.5 bg-border" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold">{item.rank} 벨트</span>
                  <span className="text-xs text-muted-foreground">{item.levels}</span>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 올 마스터 보상 */}
      <section className="px-4 py-6">
        <div className="rounded-2xl bg-gradient-to-br from-[hsl(14,90%,15%)] to-[hsl(14,40%,8%)] p-5 text-white">
          <h3 className="font-display text-lg font-bold">🏆 블랙 레벨 마스터 달성 시</h3>
          <p className="mt-1 text-sm text-white/70">
            153 레벨업 전 과정을 완주하면 받게 되는 특별 혜택
          </p>
          <div className="mt-5 space-y-3">
            {ultimateRewards.map((reward, i) => {
              const Icon = reward.icon;
              return (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
                    <Icon className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">{reward.title}</p>
                    <p className="text-[12px] leading-relaxed text-white/60">{reward.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <Button
            onClick={() => navigate("/level-map")}
            className="mt-5 w-full rounded-full"
          >
            내 레벨 확인하기
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      <section className="px-4 py-4">
        <h3 className="mb-3 font-display text-lg font-bold">📋 실제 가점 상세 정보</h3>
        <Accordion type="single" collapsible className="space-y-2">
          {detailAccordions.map((item, i) => (
            <AccordionItem key={i} value={`detail-${i}`} className="rounded-xl border border-border bg-card px-4">
              <AccordionTrigger className="text-left text-sm font-medium">
                {item.title}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* FAQ */}
      <section className="px-4 py-4">
        <h3 className="mb-3 font-display text-lg font-bold">자주 묻는 질문</h3>
        <Accordion type="single" collapsible className="space-y-2">
          {faqItems.map((item, i) => (
            <AccordionItem
              key={i}
              value={`faq-${i}`}
              className="rounded-xl border border-border bg-card px-4"
            >
              <AccordionTrigger className="text-left text-sm font-medium">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Disclaimer */}
      <section className="px-4 pb-8 pt-2">
        <div className="rounded-xl border border-border bg-muted/50 p-4">
          <p className="text-xs leading-relaxed text-muted-foreground">
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
