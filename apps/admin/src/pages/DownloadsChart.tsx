import { Table } from '@nextlevel/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

// Downloads per day (FR-ADM-6, D49): one series, so one hue and no legend (the title names it).
// Hand-drawn SVG (no chart library): columns ≤ 24px with a 4px rounded cap and a 2px gap,
// hairline grid, a tooltip per day, and the same numbers as a table.

const W = 720;
const H = 200;
const PAD = { left: 36, right: 8, top: 12, bottom: 24 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;
/** Slot 1 of the reference palette, dark step: validated on the console's #0b0b0f surface. */
const BAR = '#3987e5';
const GRID = 'rgba(255, 255, 255, 0.08)';

/** A round axis top: 1, 2 or 5 × 10ⁿ at or above `max` (at least 4, so 0/2/4 reads well). */
function niceMax(max: number): number {
  const target = Math.max(max, 4);
  const power = 10 ** Math.floor(Math.log10(target));
  const step = [1, 2, 5, 10].find((m) => m * power >= target) ?? 10;
  return step * power;
}

/** A column with a 4px rounded top, square at the baseline. */
function column(x: number, width: number, height: number): string {
  const r = Math.min(4, width / 2, height);
  const base = PAD.top + PLOT_H;
  const top = base - height;
  return `M${String(x)},${String(base)}V${String(top + r)}Q${String(x)},${String(top)} ${String(x + r)},${String(top)}H${String(x + width - r)}Q${String(x + width)},${String(top)} ${String(x + width)},${String(top + r)}V${String(base)}Z`;
}

export function DownloadsChart({ days }: { days: ReadonlyArray<{ date: string; count: number }> }) {
  const { t, i18n } = useTranslation();
  const [hovered, setHovered] = useState<number | null>(null);
  const label = (date: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00.000Z`));
  const top = niceMax(Math.max(0, ...days.map((day) => day.count)));
  const band = PLOT_W / Math.max(days.length, 1);
  const barWidth = Math.min(24, band - 2);
  const y = (value: number) => PAD.top + PLOT_H - (value / top) * PLOT_H;
  const point = hovered === null ? undefined : days[hovered];

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <svg
          role="img"
          aria-label={t('admin.dashboard.chartLabel')}
          viewBox={`0 0 ${String(W)} ${String(H)}`}
          className="h-auto w-full"
        >
          {[0, top / 2, top].map((value) => (
            <g key={value}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(value)}
                y2={y(value)}
                stroke={GRID}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={y(value)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-slate-500 text-[10px]"
              >
                {value}
              </text>
            </g>
          ))}
          {days.map((day, i) => {
            const x = PAD.left + i * band + (band - barWidth) / 2;
            const height = (day.count / top) * PLOT_H;
            return (
              <g key={day.date}>
                {hovered === i && (
                  <rect
                    x={PAD.left + i * band}
                    y={PAD.top}
                    width={band}
                    height={PLOT_H}
                    fill="rgba(255, 255, 255, 0.05)"
                  />
                )}
                {day.count > 0 && <path d={column(x, barWidth, height)} fill={BAR} />}
                {(i % 7 === 0 || i === days.length - 1) && (
                  <text
                    x={PAD.left + i * band + band / 2}
                    y={H - 8}
                    textAnchor="middle"
                    className="fill-slate-500 text-[10px]"
                  >
                    {label(day.date)}
                  </text>
                )}
                {/* The hit target is the whole day's band, taller and wider than its column. */}
                <rect
                  data-day={day.date}
                  x={PAD.left + i * band}
                  y={PAD.top}
                  width={band}
                  height={PLOT_H}
                  fill="transparent"
                  onMouseEnter={() => {
                    setHovered(i);
                  }}
                  onMouseLeave={() => {
                    setHovered(null);
                  }}
                />
              </g>
            );
          })}
        </svg>
        {point && hovered !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border border-white/10 bg-[#1a1c23] px-2 py-1 text-xs whitespace-nowrap text-slate-200 shadow-lg"
            style={{ left: `${String(((PAD.left + (hovered + 0.5) * band) / W) * 100)}%` }}
          >
            <span className="text-slate-400">{label(point.date)}</span>{' '}
            <span className="tabular-nums">
              {t('admin.dashboard.downloadsCount', { count: point.count })}
            </span>
          </div>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-200">
          {t('admin.dashboard.showTable')}
        </summary>
        <Table
          label={t('admin.dashboard.tableLabel')}
          columns={[t('admin.dashboard.date'), t('admin.dashboard.downloads')]}
          empty=""
          rows={days.map((day) => ({ key: day.date, cells: [label(day.date), day.count] }))}
        />
      </details>
    </div>
  );
}
