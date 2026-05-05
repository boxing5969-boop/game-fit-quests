/**
 * 153 스토리 RPG — 시네마틱 레터박스 (Stage 47A).
 *
 * active=true 시 위/아래 검은 바 페이드 인 (300ms).
 */

import { motion, AnimatePresence } from "framer-motion";

export interface LetterboxProps {
  active: boolean;
  height?: string;
}

const Letterbox = ({ active, height = "10vh" }: LetterboxProps) => {
  return (
    <AnimatePresence>
      {active && (
        <>
          <motion.div
            key="top"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="pointer-events-none absolute inset-x-0 top-0 z-30 bg-black"
          />
          <motion.div
            key="bottom"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-black"
          />
        </>
      )}
    </AnimatePresence>
  );
};

export default Letterbox;
