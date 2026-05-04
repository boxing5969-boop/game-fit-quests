/**
 * 153 스토리 RPG — QUEST 활동 진입 버튼 모음 (단계 38).
 *
 * 기존 기능을 직접 수정하지 않고 라우트 이동/anchor 만 제공한다.
 * 39단계에서 챕터 진행도 sync 와 연결된다.
 */

import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Brain,
  Heart,
  Trophy,
} from "lucide-react";

const ACTIONS = [
  {
    code: "quiz",
    label: "복싱 IQ",
    desc: "퀴즈로 안전과 기본기를 다집니다.",
    icon: Brain,
    href: "/home#engagement",
  },
  {
    code: "challenge",
    label: "재미 챌린지",
    desc: "오늘 한 라운드 도전.",
    icon: Trophy,
    href: "/home#engagement",
  },
  {
    code: "journal",
    label: "챔피언 일기",
    desc: "오늘의 라운드를 기록합니다.",
    icon: BookOpen,
    href: "/home#engagement",
  },
  {
    code: "cheer",
    label: "세컨드 응원",
    desc: "동료에게 응원을 보냅니다.",
    icon: Heart,
    href: "/home#engagement",
  },
];

const StoryQuestActions = () => {
  const navigate = useNavigate();
  return (
    <section className="space-y-3">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-300">
          오늘의 퀘스트
        </p>
        <h2 className="mt-0.5 text-base font-black text-foreground">
          어떤 라운드를 뛰어볼까
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.code}
              type="button"
              onClick={() => navigate(a.href)}
              className="flex items-start gap-2 rounded-2xl border border-white/10 bg-gray-900/40 p-3 text-left transition-colors active:scale-[0.99] hover:border-white/20"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-200">
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-black text-foreground">
                  {a.label}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-muted-foreground">
                  {a.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default StoryQuestActions;
