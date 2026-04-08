import confetti from "canvas-confetti";

export const celebrateSmall = () => {
  confetti({
    particleCount: 40,
    spread: 50,
    origin: { y: 0.8 },
    colors: ["#E8553A", "#F5A623", "#FFD700"],
    scalar: 0.8,
  });
};

export const celebrateLevelUp = () => {
  const duration = 2000;
  const end = Date.now() + duration;
  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ["#E8553A", "#F5A623", "#FFD700"],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ["#E8553A", "#F5A623", "#FFD700"],
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
};
