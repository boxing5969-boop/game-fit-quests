import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PUNCH_MITT_TIPS, REST_TIPS, TIER_MITT_DESC } from '@/features/minigame/lib/mittTips';
import { TIERS, PUNCHES, PunchType } from '@/features/minigame/types/game';
import { DRILL_COMBOS } from '@/features/minigame/types/mittDrill';

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
      className="min-h-screen py-8 px-4 overflow-y-auto"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md mx-auto"
      >
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">📚</div>
          <h2 className="font-display text-3xl tracking-wider text-foreground">미트 트레이닝이란?</h2>
          <p className="text-sm text-muted-foreground">MITT TRAINING ACADEMY</p>
          <p className="text-[10px] text-muted-foreground mt-1">5초마다 자동 전환 · 화면을 누르면 일시정지</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-2 bg-muted rounded-lg p-1">
          {([
            { key: 'basics' as Tab, label: '기초' },
            { key: 'punches' as Tab, label: '펀치' },
            { key: 'combos' as Tab, label: '콤보' },
            { key: 'tiers' as Tab, label: '등급' },
          ]).map(t => (
            <button
              key={t.key}
              onClick={() => handleSetTab(t.key)}
              className={`flex-1 py-2 text-sm font-display tracking-wider rounded-md transition-colors ${
                tab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Auto-advance progress bar */}
        <div className="h-1 bg-muted rounded-full overflow-hidden mb-6">
          <div
            className="h-full bg-secondary transition-[width] duration-75 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          {tab === 'basics' && (
            <motion.div key="basics" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {/* What is mitt training */}
              <div className="bg-card border border-border rounded-xl p-4">
                <div className="font-display text-lg text-foreground tracking-wider mb-2">🥊 미트 트레이닝이란?</div>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  트레이너가 들고 있는 미트(패드)를 정확한 타이밍에 치는 훈련입니다.
                  단순한 운동이 아닌 타이밍, 반응속도, 정확도를 동시에 키우는 복싱의 핵심 훈련입니다.
                </p>
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <div className="font-display text-lg text-foreground tracking-wider mb-2">⚡ 왜 미트인가?</div>
                <ul className="space-y-2 text-sm text-foreground/80">
                  <li>• 샌드백은 기다려주지만 미트는 움직입니다</li>
                  <li>• 살아있는 타이밍 감각은 미트에서만 만들어집니다</li>
                  <li>• 반복할수록 몸이 먼저 반응하는 근육기억이 생깁니다</li>
                </ul>
                <div className="mt-3 bg-primary/10 border border-primary/20 rounded-lg p-3 text-center">
                  <p className="text-sm font-bold text-secondary italic">
                    "샌드백 1000번보다 미트 100번이 실전에 가깝다"
                  </p>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <div className="font-display text-lg text-foreground tracking-wider mb-2">🏆 타이밍 마스터 4단계</div>
                <div className="space-y-2">
                  {[
                    { step: 1, text: '트레이너 미트 위치 인식' },
                    { step: 2, text: '거리와 타이밍 계산' },
                    { step: 3, text: '정확한 순간에 카운터' },
                    { step: 4, text: '반복으로 자동화' },
                  ].map(s => (
                    <div key={s.step} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-primary/20 text-primary font-display text-sm flex items-center justify-center shrink-0">
                        {s.step}
                      </div>
                      <span className="text-sm text-foreground/80">{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Training tips */}
              {REST_TIPS.map((tip, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-4">
                  <div className="text-xs font-display tracking-widest text-secondary mb-2">
                    {tip.icon} {tip.title}
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
                <div key={type} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{PUNCHES[type].emoji}</span>
                    <div>
                      <div className="font-display text-xl text-foreground">{PUNCHES[type].nameEn}</div>
                      <div className="text-sm text-muted-foreground">{PUNCHES[type].nameKo}</div>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80">{PUNCH_MITT_TIPS[type]}</p>
                </div>
              ))}

              <div className="bg-card border border-primary/20 rounded-xl p-4">
                <div className="font-display text-lg text-foreground tracking-wider mb-2">🎯 타이밍 존 가이드</div>
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
                <div key={combo.id} className="bg-card border border-border rounded-xl p-4">
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
                      <span key={i} className="bg-muted rounded-lg px-2 py-1 text-sm flex items-center gap-1">
                        <span>{PUNCHES[step.punch].emoji}</span>
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
                <div key={t.key} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-3xl">{t.emoji}</span>
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
          onClick={onBack}
          className="w-full mt-8 punch-btn bg-muted text-foreground py-4 font-display tracking-widest"
        >
          ← BACK
        </button>
      </motion.div>
    </div>
  );
};

export default EducationScreen;
