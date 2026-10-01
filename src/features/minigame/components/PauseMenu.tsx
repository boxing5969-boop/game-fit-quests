/**
 * ⏸ 일시정지 메뉴 — 세 게임이 같이 쓴다 (2026-10-01).
 * 사운드·진동 토글, 계속하기, (게임 방법), 처음부터, 나가기 — 처음부터·나가기는 한 번 더 확인.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { BookOpen, LogOut, Pause, Play, RotateCcw, Vibrate, VibrateOff, Volume2, VolumeX } from 'lucide-react';
import { audio, isVibrationEnabled, setVibrationEnabled } from '@/features/minigame/lib/audio';

interface Props {
  /** 제목 아래 한 줄 — "ROUND 3 · 1,240점 · 0:42" */
  summary?: string;
  onResume: () => void;
  onRestart?: () => void;
  onQuit: () => void;
  /** 처음부터 확인창 본문 */
  restartNote?: string;
  quitNote?: string;
  /** 게임 방법 패널 (있으면 버튼이 생긴다) */
  help?: ReactNode;
  resumeLabel?: string;
  quitLabel?: string;
}

const Toggle = ({ on }: { on: boolean }) => (
  <span className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? 'bg-primary' : 'bg-white/15'}`}>
    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
  </span>
);

const PauseMenu = ({
  summary, onResume, onRestart, onQuit, restartNote, quitNote, help,
  resumeLabel = '계속하기', quitLabel = '나가기',
}: Props) => {
  const [soundOn, setSoundOn] = useState(() => audio.isEnabled());
  const [vibrationOn, setVibrationOn] = useState(() => isVibrationEnabled());
  const [showHelp, setShowHelp] = useState(false);
  const [confirm, setConfirm] = useState<'restart' | 'quit' | null>(null);

  const toggleSound = () => {
    const next = !soundOn;
    audio.setEnabled(next);
    setSoundOn(next);
    if (next) audio.tap();
  };
  const toggleVibration = () => {
    const next = !vibrationOn;
    setVibrationEnabled(next);
    setVibrationOn(next);
    if (next && 'vibrate' in navigator) {
      try { navigator.vibrate(20); } catch { /* 지원 안 함 */ }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-6 backdrop-blur-md"
    >
      <motion.div
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 240 }}
        className="mg-card w-full max-w-sm p-5"
      >
        <div className="mb-4 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
            <Pause className="h-6 w-6 text-foreground" fill="currentColor" />
          </div>
          <h3 className="font-display text-3xl tracking-[0.2em] text-foreground">PAUSED</h3>
          {summary && <p className="mt-1 text-[12px] font-semibold text-muted-foreground">{summary}</p>}
        </div>

        <div className="mb-3 space-y-1 rounded-2xl bg-white/[0.04] p-2 ring-1 ring-white/[0.06]">
          <button type="button" onClick={toggleSound} className="flex w-full items-center justify-between rounded-xl px-2.5 py-2.5 active:bg-white/[0.05]">
            <span className="flex items-center gap-2.5 text-[14px] font-bold text-foreground">
              {soundOn ? <Volume2 className="h-5 w-5 text-primary" /> : <VolumeX className="h-5 w-5 text-muted-foreground" />} 사운드
            </span>
            <Toggle on={soundOn} />
          </button>
          <button type="button" onClick={toggleVibration} className="flex w-full items-center justify-between rounded-xl px-2.5 py-2.5 active:bg-white/[0.05]">
            <span className="flex items-center gap-2.5 text-[14px] font-bold text-foreground">
              {vibrationOn ? <Vibrate className="h-5 w-5 text-primary" /> : <VibrateOff className="h-5 w-5 text-muted-foreground" />} 진동
            </span>
            <Toggle on={vibrationOn} />
          </button>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => { audio.tap(); onResume(); }}
            className="mg-btn-primary flex h-12 w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-xl tracking-widest"
          >
            <Play className="h-5 w-5 fill-current" /> {resumeLabel}
          </button>
          {help && (
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="mg-btn-ghost flex h-11 w-full items-center justify-center gap-2 rounded-2xl font-display text-[15px] tracking-widest"
            >
              <BookOpen className="h-4 w-4" /> 게임 방법
            </button>
          )}
          {onRestart && (
            <button
              type="button"
              onClick={() => setConfirm('restart')}
              className="mg-btn-ghost flex h-11 w-full items-center justify-center gap-2 rounded-2xl font-display text-[15px] tracking-widest"
            >
              <RotateCcw className="h-4 w-4" /> 처음부터
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirm('quit')}
            className="mg-btn-danger flex h-11 w-full items-center justify-center gap-2 rounded-2xl font-display text-[15px] tracking-widest"
          >
            <LogOut className="h-4 w-4" /> {quitLabel}
          </button>
        </div>
      </motion.div>

      {/* 게임 방법 */}
      <AnimatePresence>
        {showHelp && help && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-background/90 px-6 backdrop-blur"
            onClick={() => setShowHelp(false)}
          >
            <motion.div
              initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="mg-card w-full max-w-sm p-5"
            >
              <h4 className="mb-3 flex items-center justify-center gap-2 font-display text-xl tracking-widest text-foreground">
                <BookOpen className="h-5 w-5 text-primary" /> 게임 방법
              </h4>
              {help}
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="mg-btn-primary mt-4 h-11 w-full rounded-2xl font-display text-lg tracking-widest"
              >
                확인
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 확인창 */}
      <AnimatePresence>
        {confirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-background/90 px-6 backdrop-blur"
          >
            <motion.div
              initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className={`mg-card w-full max-w-xs p-5 text-center ${confirm === 'quit' ? 'ring-1 ring-destructive/40' : ''}`}
            >
              <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06]">
                {confirm === 'restart' ? <RotateCcw className="h-5 w-5 text-foreground" /> : <LogOut className="h-5 w-5 text-destructive" />}
              </div>
              <h4 className="mb-1 font-display text-xl tracking-widest text-foreground">
                {confirm === 'restart' ? '처음부터?' : '정말 나갈까요?'}
              </h4>
              <p className="mb-4 text-[12px] text-muted-foreground">
                {confirm === 'restart' ? (restartNote ?? '지금 진행이 사라집니다') : (quitNote ?? '지금 진행은 저장되지 않습니다')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setConfirm(null)} className="mg-btn-ghost h-11 rounded-xl font-display text-[15px] tracking-widest">취소</button>
                <button
                  type="button"
                  onClick={() => { const c = confirm; setConfirm(null); if (c === 'restart') onRestart?.(); else onQuit(); }}
                  className={`h-11 rounded-xl font-display text-[15px] tracking-widest ${confirm === 'restart' ? 'mg-btn-primary' : 'bg-destructive text-destructive-foreground'}`}
                >
                  {confirm === 'restart' ? '다시' : '나가기'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default PauseMenu;
