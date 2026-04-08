import { useState, useCallback, useEffect } from "react";
import { Award, Shield, Briefcase, GraduationCap, Users, ChevronLeft, ArrowRight } from "lucide-react";
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

const heroBadges = [
  { label: "실제 가점", icon: Award },
  { label: "공인체육관", icon: Shield },
  { label: "코치 진로", icon: Briefcase },
  { label: "간접 가점", icon: Users },
];

const cardContents = [
  {
    icon: Award,
    title: "복싱단증은 그냥 수료증이 아닙니다",
    mainCopy: '단증은 "오래 했다"가 아니라\n어느 단계까지 증명됐는지를 보여줍니다',
    body: [
      "복싱단증은 단순 출석기록이 아니라 단계별 수련 수준을 공식적으로 보여주는 증명입니다.",
      "153 레벨업은 공식 단증 취득을 준비하는 성장 여정으로 구성되어 있습니다.",
      '레벨업의 끝은 "잘했다"가 아니라 "증명된다"입니다.',
    ],
    highlight: "운동의 기록이 아니라, 성장의 증명",
    cta: "공식 단증이란?",
  },
  {
    icon: Shield,
    title: "4단은 지도자 신뢰의 문턱입니다",
    mainCopy: "4단은 잘하는 수준을 넘어\n운영 가능한 지도자 레벨로 읽힙니다",
    body: [
      "공인체육관, 지도자 신뢰, 브랜드 공신력과 연결되는 레벨입니다.",
      '"실력 있는 사람"보다 "공식 기준을 갖춘 사람"으로 인정받게 됩니다.',
      "4단은 단순 숫자가 아니라 권위와 책임의 기준입니다.",
    ],
    highlight: "4단은 신뢰가 생기는 선",
    cta: "4단이 중요한 이유",
  },
  {
    icon: Briefcase,
    title: "채용에서 바로 쓰이는\n실제 가점도 있습니다",
    mainCopy: "인정단체 발급 단증은\n실제 채용에서 힘이 될 수 있습니다",
    body: [
      "경찰, 청원경찰, 방호 관련 채용에서 인정단체 발급 무도단증이 반영될 수 있습니다.",
      "단수에 따라 차이가 있고, 공고 기준이 다를 수 있습니다.",
      '"막연한 자부심"이 아니라 "실제 활용 가능성"입니다.',
    ],
    highlight: "실제 가점은 기준으로 결정됩니다",
    cta: "실제 가점 예시 보기",
  },
  {
    icon: GraduationCap,
    title: "복싱단증은 코치 커리어의\n출발선이 됩니다",
    mainCopy: "단증은 코치 자격 트랙으로\n이어지는 준비도입니다",
    body: [
      "복싱 지도, 코칭, 수업 운영, 지도자 성장의 출발점이 됩니다.",
      "국가 체육지도자 자격까지 이어질 수 있는 장기 성장 경로입니다.",
      '"단증 = 끝"이 아니라 "단증 = 다음 문을 여는 열쇠"입니다.',
    ],
    highlight: "단증은 코치 커리어의 시작",
    cta: "코치 자격 트랙 보기",
  },
  {
    icon: Users,
    title: "간접 가점은 더 오래 갑니다",
    mainCopy: "점수보다 먼저 올라가는 건\n신뢰와 설득력입니다",
    body: [
      "취업, 회원 모집, 부모 신뢰, 자기소개서, 면접 설득력에 도움됩니다.",
      "법정 가산점이 아닌 실무적 간접 가치입니다.",
      '"단증을 따면 내 미래가 달라진다"는 힘을 느끼게 됩니다.',
    ],
    highlight: "단증은 점수표보다 먼저 사람을 설득합니다",
    cta: "단증이 취업에 주는 힘",
  },
];

const faqItems = [
  {
    q: "153 레벨과 공식 단증은 같은 건가요?",
    a: "153 레벨업은 내부 성장 시스템으로, 공식 단증과는 별개입니다. 다만 153 레벨업 과정이 공식 단증 취득을 준비하는 데 도움이 되도록 설계되어 있습니다.",
  },
  {
    q: "복싱단증이 있으면 경찰/공공채용 가점이 무조건 되나요?",
    a: "무도단증 가점은 채용공고, 발급 단체, 단수 등 기준에 따라 달라집니다. 모든 채용에서 자동 반영되는 것은 아니며, 해당 공고의 구체적인 요건을 확인해야 합니다.",
  },
  {
    q: "왜 4단이 중요하나요?",
    a: "4단은 공인체육관 운영, 지도자 신뢰, 코치 커리어 등에서 기준이 되는 단수입니다. 단순히 높은 단수가 아니라 지도자로서의 책임과 권위가 인정되기 시작하는 레벨입니다.",
  },
  {
    q: "단증만 있으면 바로 코치가 될 수 있나요?",
    a: "단증은 코치 커리어의 출발점이지만, 실제 지도 활동을 위해서는 추가적인 자격 요건(예: 국가 체육지도자 자격)이 필요할 수 있습니다. 단증은 그 준비 과정의 중요한 첫 단계입니다.",
  },
];

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

      {/* 실제 가점 상세 정보 */}
      <section className="px-4 py-4">
        <h3 className="mb-3 font-display text-lg font-bold">📋 실제 가점 상세 정보</h3>
        <Accordion type="single" collapsible className="space-y-2">
          <AccordionItem value="detail-0" className="rounded-xl border border-border bg-card px-4">
            <AccordionTrigger className="text-left text-sm font-medium">
              경찰공무원 — 체력검사에서 실제 점수 반영
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              경찰 채용 FAQ 기준으로 무도단증은 체력검사 평가단계 성적 계산 시 반영되며, 2·3단은 1점, 4단 이상은 2점이 부여됩니다. 2026년 경찰 채용 체력시험 점수 인정 무도단체 현황에는 대한복싱협회가 포함되어 있어, 대한복싱협회 발급 복싱단증 4단은 경찰 채용에서 실제 점수로 연결될 수 있습니다. 단, 적용 여부는 해당 연도 공고를 기준으로 확인해야 합니다.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="detail-1" className="rounded-xl border border-border bg-card px-4">
            <AccordionTrigger className="text-left text-sm font-medium">
              해양경찰 — 면접시험 가산 자격증 배점 적용
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              해양경찰청 채용 면접시험 가산 자격증 배점기준표에는 무도 분야가 별도로 있고, 1·2단은 1점, 3단은 2점, 4단 이상은 3점으로 구분됩니다. 2026년 해양경찰 채용 공고의 무도분야 인정 단체 목록에는 대한복싱협회가 포함되어 있어, 복싱단증 4단은 해양경찰 준비생에게 매우 강한 실전 가치로 전달할 수 있습니다.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="detail-2" className="rounded-xl border border-border bg-card px-4">
            <AccordionTrigger className="text-left text-sm font-medium">
              군 모집 전형 — 일부 특임·특기 전형에서 정량 배점 사례
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              육군 특임군사경찰 전형은 무도단증 배점을 별도로 두고 있으며, 1단 9점 / 2단 11점 / 3단 13점 / 4단 이상 15점으로 안내합니다. 인정 단체 목록에 대한복싱협회가 포함되어 있어, 이 전형에서는 복싱단증 4단이 매우 강한 경쟁력으로 작동할 수 있습니다. 다만 이 내용은 군 전체 공통 규정이 아니라 특정 모집·특기 전형 사례입니다.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="detail-3" className="rounded-xl border border-border bg-card px-4">
            <AccordionTrigger className="text-left text-sm font-medium">
              군 전형은 전부 같지 않습니다 — 최신 공고 확인 필수
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              해군 일반기술병은 무도단증을 인정하지만 태권도·유도·검도·합기도·특공무술만 명시하고 단수와 관계없이 동일 배점을 적용합니다. 공군 일반기술병도 무도단증을 인정하지만 단수와 관계없이 동일 배점이며, 인정 종목은 별도 지원요건 검색을 확인하도록 안내합니다. 해병대는 2026년 1월 입영 모집부터 병 모집에서 무도단증 별도 가산점 항목을 폐지했습니다. 따라서 '군 전체 가산점'보다 '일부 모집·특기 전형에서 배점 사례가 있다'로 이해하는 것이 정확합니다.
            </AccordionContent>
          </AccordionItem>
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
