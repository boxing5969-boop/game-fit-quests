/**
 * 📚 미트 트레이닝 배우기 (2026-10-01 다크 아레나 개편: 이모지 → 입체 아이콘·방향 기호).
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Lightbulb } from 'lucide-react';
import { PUNCH_MITT_TIPS, REST_TIPS, TIER_MITT_DESC } from '@/features/minigame/lib/mittTips';
import { TIERS, PUNCHES, PunchType } from '@/features/minigame/types/game';
import { DRILL_COMBOS } from '@/features/minigame/types/mittDrill';
import { audio } from '@/features/minigame/lib/audio';
import Icon3D, { TIER_ICON } from './Icon3D';
import PunchGlyph from './PunchGlyph';

const PUNCH_BG: Record<PunchType, string> = {
  jab: 'bg-punch-jab text-[hsl(165_70%_7%)]',
  straight: 'bg-punch-straight text-[hsl(40_60%_8%)]',
  hook: 'bg-punch-hook text-white',
  upper: 'bg-punch-upper text-[hsl(210_22%_10%)]',
};

interface EducationScreenProps {
  onBack: () => void;
}

type Tab = 'basics' | 'punches' | 'combos' | 'tiers';

const TABS: Tab[] = ['basics', 'punches', 'combos', 'tiers'];
const AUTO_ADVANCE_MS = 5000;

const EducationScreen = ({ onBack }: EducationScreenProps) => {
  const [tab, setTab] = useState<Tab>('basics');
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  // Auto-advance every 5 seconds, unless paused
  useEffect(() => {
    setProgress(0);
    if (paused) return;
    const start = performance.now();
    const raf = { id: 0 };
    const step = () => {
      const elapsed = performance.now() - start;
      const pct = Math.min(elapsed / AUTO_ADVANCE_MS, 1);
      setProgress(pct);
      if (pct >= 1) {
        const idx = TABS.indexOf(tab);
        const next = TABS[(idx + 1) % TABS.length];
        setTab(next);
      } else {
        raf.id = requestAnimationFrame(step);
      }
    };
    raf.id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.id);
  }, [tab, paused]);

  const handleSetTab = (t: Tab) => {
    setTab(t);
    setProgress(0);
  };

  return (
    <div
      className="arena-bg arena-ropes min-h-screen overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] pt-[calc(env(safe-area-inset-top)+1rem)]"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto"
      >
        <div className="relative mb-5 text-center">
          <button
            type="button"
            onClick={() => { audio.tap(); onBack(); }}
            className="absolute left-0 top-0 flex h-9 items-center gap-1 rounded-full bg-card/80 px-3 text-[12px] font-bold text-foreground ring-1 ring-white/10 backdrop-blur-md active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" /> 뒤로
          </button>
          <Icon3D name="book" size={72} className="mx-auto mb-1" />
          <h2 className="text-[22px] font-black tracking-tight text-foreground">미트 트레이닝이란?</h2>
          <p className="font-display text-[12px] tracking-[0.25em] text-primary">MITT TRAINING ACADEMY</p>
          <p className="mt-1 text-[11px] text-muted-foreground">5초마다 자동 전환 · 화면을 누르면 일시정지</p>
        </div>

        {/* Tabs */}
        <div className="mb-2 flex gap-1 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/[0.08]">
          {([
            { key: 'basics' as Tab, label: '기초' },
            { key: 'punches' as Tab, label: '펀치' },
            { key: 'combos' as Tab, label: '콤보' },
            { key: 'tiers' as Tab, label: '등급' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => { audio.tap(); handleSetTab(t.key); }}
              className={`flex-1 rounded-full py-2 text-[13px] font-bold transition-colors ${
                tab === t.key ? 'bg-foreground text-background' : 'text-muted-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Auto-advance progress bar */}
        <div className="mb-5 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-primary transition-[width] duration-75 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          {tab === 'basics' && (
            <motion.div key="basics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* What is mitt training */}
              <div className="mg-card p-4">
                <div className="mb-2 flex items-center gap-2 text-[15px] font-black text-foreground"><Icon3D name="mitt" size={26} /> 미트 트레이닝이란?</div>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  트레이너가 들고 있는 미트(패드)를 정확한 타이밍에 치는 훈련입니다.
                  단순한 운동이 아닌 타이밍, 반응속도, 정확도를 동시에 키우는 복싱의 핵심 훈련입니다.
                </p>
              </div>

              <div className="mg-card p-4">
                <div className="mb-2 flex items-center gap-2 text-[15px] font-black text-foreground"><Icon3D name="bolt" size={26} /> 왜 미트인가?</div>
                <ul className="space-y-2 text-sm text-foreground/80">
                  <li>• 샌드백은 기다려주지만 미트는 움직입니다</li>
                  <li>• 살아있는 타이밍 감각은 미트에서만 만들어집니다</li>
                  <li>• 반복할수록 몸이 먼저 반응하는 근육기억이 생깁니다</li>
                </ul>
                <div className="mt-3 rounded-xl bg-primary/10 p-3 text-center ring-1 ring-primary/20">
                  <p className="text-sm font-bold italic text-secondary">
                    "샌드백 1000번보다 미트 100번이 실전에 가깝다"
                  </p>
                </div>
              </div>

              <div className="mg-card p-4">
                <div className="mb-2 flex items-center gap-2 text-[15px] font-black text-foreground"><Icon3D name="trophy" size={26} /> 타이밍 마스터 4단계</div>
                <div className="space-y-2">
                  {[
                    { step: 1, text: '트레이너 미트 위치 인식' },
                    { step: 2, text: '거리와 타이밍 계산' },
                    { step: 3, text: '정확한 순간에 카운터' },
                    { step: 4, text: '반복으로 자동화' },
                  ].map(s => (
                    <div key={s.step} className="flex items-center gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 font-display text-sm text-primary">
                        {s.step}
                      </div>
                      <span className="text-sm text-foreground/80">{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Training tips */}
              {REST_TIPS.map((tip, i) => (
                <div key={i} className="mg-card p-4">
                  <div className="mb-2 flex items-center gap-2 font-display text-[12px] tracking-widest text-secondary">
                    <Icon3D name={tip.icon} size={22} /> {tip.title}
                  </div>
                  {tip.lines.map((line, j) => (
                    <p key={j} className="text-sm text-foreground/80 leading-relaxed">{line}</p>
                  ))}
                </div>
              ))}
            </motion.div>
          )}

          {tab === 'punches' && (
            <motion.div key="punches" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {(['jab', 'straight', 'hook', 'upper'] as PunchType[]).map(type => (
                <div key={type} className="mg-card p-4">
                  <div className="mb-2 flex items-center gap-3">
                    <span className={`flex h-11 w-11 items-center justify-center rounded-full ${PUNCH_BG[type]}`}>
                      <PunchGlyph type={type} size={24} />
                    </span>
                    <div>
                      <div className="font-display text-xl text-foreground">{PUNCHES[type].nameEn}</div>
                      <div className="text-sm text-muted-foreground">{PUNCHES[type].nameKo}</div>
                    </div>
                  </div>
                  <p className="flex items-start gap-1.5 text-sm text-foreground/80"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />{PUNCH_MITT_TIPS[type]}</p>
                </div>
              ))}

              <div className="mg-card p-4 ring-1 ring-primary/20">
                <div className="mb-2 flex items-center gap-2 text-[15px] font-black text-foreground"><Icon3D name="stopwatch" size={26} /> 타이밍 존 가이드</div>
                <div className="space-y-2 text-sm">
                  <div><span className="text-rating-lightning font-bold">PERFECT</span> = 트레이너가 미트를 내밀 때 딱 맞추는 것</div>
                  <div><span className="text-rating-slow font-bold">TOO EARLY</span> = 미트가 오기 전에 쳐서 허공을 가르는 것</div>
                  <div><span className="text-rating-miss font-bold">TOO LATE</span> = 미트가 이미 지나간 후 치는 것</div>
                  <div><span className="text-secondary font-bold">FEINT</span> = 트레이너가 미트를 뺄 때 속지 않는 것</div>
                </div>
              </div>
            </motion.div>
          )}

          {tab === 'combos' && (
            <motion.div key="combos" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {DRILL_COMBOS.map(combo => (
                <div key={combo.id} className="mg-card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="font-display text-lg text-foreground">{combo.name}</div>
                      <div className="text-xs text-muted-foreground">{combo.nameKo}</div>
                    </div>
                    <div className="flex gap-1">
                      {[1, 2, 3].map(d => (
                        <span key={d} className={`w-2 h-2 rounded-full ${d <= combo.difficulty ? 'bg-primary' : 'bg-muted'}`} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {combo.steps.map((step, i) => (
                      <span key={i} className="flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-2 py-1 text-sm">
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full ${PUNCH_BG[step.punch]}`}>
                          <PunchGlyph type={step.punch} size={12} strokeWidth={3} />
                        </span>
                        <span className="text-foreground/80">{step.label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {tab === 'tiers' && (
            <motion.div key="tiers" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
              {TIERS.map(t => (
                <div key={t.key} className="mg-card p-4">
                  <div className="mb-2 flex items-center gap-3">
                    <Icon3D name={TIER_ICON[t.key]} size={40} />
                    <div>
                      <span className={`font-display text-xl tracking-wider text-tier-${t.key}`}>
                        {t.nameEn.toUpperCase()}
                      </span>
                      <span className={`text-sm text-tier-${t.key}/80 ml-2`}>{t.nameKo}</span>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80 whitespace-pre-line">{TIER_MITT_DESC[t.key]}</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          type="button"
          onClick={() => { audio.tap(); onBack(); }}
          className="mg-btn-ghost mt-8 flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-display text-lg tracking-widest"
        >
          <ArrowLeft className="h-4 w-4" /> BACK
        </button>
      </motion.div>
    </div>
  );
};

export default EducationScreen;
