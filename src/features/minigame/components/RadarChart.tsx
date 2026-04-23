import { RadarStats } from '@/features/minigame/lib/report';

interface RadarChartProps {
  stats: RadarStats;
  size?: number;
}

const LABELS: { key: keyof RadarStats; ko: string; en: string }[] = [
  { key: 'speed', ko: '속도', en: 'SPEED' },
  { key: 'accuracy', ko: '정확도', en: 'ACCURACY' },
  { key: 'consistency', ko: '일관성', en: 'CONSIST' },
  { key: 'combo', ko: '콤보', en: 'COMBO' },
  { key: 'stamina', ko: '체력', en: 'STAMINA' },
];

const RadarChart = ({ stats, size = 260 }: RadarChartProps) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 40;
  const n = LABELS.length;

  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;

  const point = (i: number, value: number) => {
    const a = angle(i);
    const dist = (value / 100) * r;
    return [cx + Math.cos(a) * dist, cy + Math.sin(a) * dist];
  };

  // Background rings
  const rings = [0.25, 0.5, 0.75, 1].map(scale => {
    const pts = LABELS.map((_, i) => point(i, 100 * scale).join(',')).join(' ');
    return <polygon key={scale} points={pts} fill="none" stroke="hsl(var(--border))" strokeWidth="1" />;
  });

  // Axis lines
  const axes = LABELS.map((_, i) => {
    const [x, y] = point(i, 100);
    return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="hsl(var(--border))" strokeWidth="1" />;
  });

  // Stats polygon
  const statPoints = LABELS.map((l, i) => point(i, stats[l.key]).join(',')).join(' ');

  // Labels
  const labels = LABELS.map((l, i) => {
    const a = angle(i);
    const lx = cx + Math.cos(a) * (r + 22);
    const ly = cy + Math.sin(a) * (r + 22);
    return (
      <g key={l.key}>
        <text
          x={lx} y={ly}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-muted-foreground font-display text-[11px] tracking-wider"
        >
          {l.en}
        </text>
        <text
          x={lx} y={ly + 12}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-foreground font-bold text-[12px]"
        >
          {Math.round(stats[l.key])}
        </text>
      </g>
    );
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {rings}
      {axes}
      <polygon
        points={statPoints}
        fill="hsl(var(--primary) / 0.3)"
        stroke="hsl(var(--primary))"
        strokeWidth="2"
      />
      {LABELS.map((l, i) => {
        const [x, y] = point(i, stats[l.key]);
        return <circle key={l.key} cx={x} cy={y} r="4" fill="hsl(var(--secondary))" />;
      })}
      {labels}
    </svg>
  );
};

export default RadarChart;
