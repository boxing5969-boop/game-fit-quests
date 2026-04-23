import { useState } from 'react';
import { motion } from 'framer-motion';
import { getSavedPlayerName } from '@/features/minigame/lib/storage';

interface NameEntryProps {
  onSubmit: (name: string) => void;
  onBack: () => void;
}

const NameEntry = ({ onSubmit, onBack }: NameEntryProps) => {
  const [name, setName] = useState(getSavedPlayerName());

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm"
      >
        <div className="text-5xl text-center mb-6">🥊</div>
        <h2 className="font-display text-4xl text-center tracking-wider text-foreground mb-2">
          FIGHTER NAME
        </h2>
        <p className="text-center text-muted-foreground mb-8">선수 이름을 입력하세요</p>

        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={20}
          placeholder="이름 입력..."
          className="w-full bg-muted border border-border rounded-xl px-5 py-4 text-xl text-foreground text-center font-display tracking-wider placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-6"
          autoFocus
          onKeyDown={e => {
            if (e.key === 'Enter' && name.trim()) onSubmit(name.trim());
          }}
        />

        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => name.trim() && onSubmit(name.trim())}
          disabled={!name.trim()}
          className="punch-btn w-full bg-primary text-primary-foreground py-5 text-xl font-display tracking-widest disabled:opacity-40"
        >
          FIGHT! 시작!
        </motion.button>

        <button onClick={onBack} className="w-full mt-4 text-muted-foreground text-sm py-2">
          ← 뒤로가기
        </button>
      </motion.div>
    </div>
  );
};

export default NameEntry;
