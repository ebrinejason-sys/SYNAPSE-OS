"use client";

type MiniSparklineProps = {
  values: number[];
  color?: string;
  className?: string;
};

export function MiniSparkline({ values, color = "#F97316", className = "" }: MiniSparklineProps) {
  const series = values.length > 0 ? values : [0];
  const max = Math.max(...series, 1);
  const min = Math.min(...series, 0);
  const range = max - min || 1;
  const width = 96;
  const height = 28;
  const step = series.length > 1 ? width / (series.length - 1) : width;

  const points = series
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={`h-7 w-24 ${className}`}
      aria-hidden
      preserveAspectRatio="none"
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
