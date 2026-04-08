import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ZoomIn, ZoomOut } from "lucide-react";
import { format, addWeeks, parseISO, startOfWeek } from "date-fns";

export interface GanttTask {
  id: string;
  title: string;
  trade: string;
  color: string;
  startWeek: number;
  durationWeeks: number;
  isMilestone: boolean;
  notes?: string | null;
  orderIndex: number;
}

interface GanttChartProps {
  tasks: GanttTask[];
  startDate: string;
  durationWeeks: number;
  title?: string;
  compact?: boolean;
}

const ROW_HEIGHT = 40;
const MILESTONE_SIZE = 14;
const LABEL_WIDTH = 220;
const MIN_WEEK_WIDTH = 36;

export function GanttChart({ tasks, startDate, durationWeeks, title, compact }: GanttChartProps) {
  const [weekWidth, setWeekWidth] = useState(compact ? 44 : 56);
  const containerRef = useRef<HTMLDivElement>(null);

  const projectStart = useMemo(() => {
    try { return parseISO(startDate); } catch { return new Date(); }
  }, [startDate]);

  const sorted = useMemo(() => [...tasks].sort((a, b) => a.orderIndex - b.orderIndex), [tasks]);

  const totalWidth = LABEL_WIDTH + durationWeeks * weekWidth;
  const chartHeight = sorted.length * ROW_HEIGHT + 60;

  // Group weeks into months for header
  const monthGroups = useMemo(() => {
    const groups: { label: string; startWeek: number; span: number }[] = [];
    for (let w = 0; w < durationWeeks; w++) {
      const d = addWeeks(projectStart, w);
      const label = format(d, "MMM yyyy");
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.span++;
      } else {
        groups.push({ label, startWeek: w, span: 1 });
      }
    }
    return groups;
  }, [projectStart, durationWeeks]);

  const handleDownloadSVG = () => {
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) return;
    const clone = svgEl.cloneNode(true) as SVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const blob = new Blob([clone.outerHTML], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "project-timeline"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekWidth(w => Math.max(MIN_WEEK_WIDTH, w - 8))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-gray-500">Zoom</span>
          <Button variant="outline" size="sm" onClick={() => setWeekWidth(w => Math.min(120, w + 8))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleDownloadSVG} className="gap-1.5">
          <Download className="h-4 w-4" /> Export SVG
        </Button>
      </div>

      {/* Trade legend */}
      <div className="flex flex-wrap gap-2">
        {Array.from(new Set(sorted.map(t => t.trade))).map(trade => {
          const task = sorted.find(t => t.trade === trade)!;
          return (
            <Badge key={trade} style={{ backgroundColor: task.color + "22", color: task.color, borderColor: task.color + "44" }}
              variant="outline" className="text-xs font-medium">
              <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: task.color }} />
              {trade}
            </Badge>
          );
        })}
      </div>

      {/* Chart */}
      <div ref={containerRef} className="overflow-x-auto overflow-y-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <svg width={totalWidth} height={chartHeight} style={{ display: "block", fontFamily: "inherit" }}>
          {/* Background */}
          <rect width={totalWidth} height={chartHeight} fill="#fafafa" />

          {/* Month header row */}
          <rect x={0} y={0} width={totalWidth} height={28} fill="#f1f5f9" />
          <rect x={0} y={0} width={LABEL_WIDTH} height={28} fill="#e2e8f0" />
          <text x={LABEL_WIDTH / 2} y={18} textAnchor="middle" fontSize={11} fontWeight="600" fill="#475569">TASK</text>

          {monthGroups.map((mg, i) => (
            <g key={i}>
              <rect x={LABEL_WIDTH + mg.startWeek * weekWidth} y={0} width={mg.span * weekWidth} height={28}
                fill={i % 2 === 0 ? "#f1f5f9" : "#e8eef4"} stroke="#cbd5e1" strokeWidth={0.5} />
              <text x={LABEL_WIDTH + (mg.startWeek + mg.span / 2) * weekWidth} y={18}
                textAnchor="middle" fontSize={11} fontWeight="600" fill="#334155">
                {mg.label}
              </text>
            </g>
          ))}

          {/* Week number sub-header */}
          <rect x={0} y={28} width={totalWidth} height={20} fill="#f8fafc" />
          {Array.from({ length: durationWeeks }).map((_, w) => (
            <g key={w}>
              <rect x={LABEL_WIDTH + w * weekWidth} y={28} width={weekWidth} height={20}
                fill="transparent" stroke="#e2e8f0" strokeWidth={0.5} />
              {weekWidth >= 44 && (
                <text x={LABEL_WIDTH + w * weekWidth + weekWidth / 2} y={41}
                  textAnchor="middle" fontSize={9} fill="#94a3b8">
                  W{w + 1}
                </text>
              )}
            </g>
          ))}

          {/* Grid + task rows */}
          {sorted.map((task, idx) => {
            const y = 48 + idx * ROW_HEIGHT;
            const barX = LABEL_WIDTH + task.startWeek * weekWidth;
            const barW = task.durationWeeks * weekWidth;
            const barY = y + (ROW_HEIGHT - (task.isMilestone ? MILESTONE_SIZE : 22)) / 2;

            return (
              <g key={task.id}>
                {/* Row bg */}
                <rect x={0} y={y} width={totalWidth} height={ROW_HEIGHT}
                  fill={idx % 2 === 0 ? "#ffffff" : "#f8fafc"} />

                {/* Vertical grid lines */}
                {Array.from({ length: durationWeeks }).map((_, w) => (
                  <line key={w} x1={LABEL_WIDTH + w * weekWidth} y1={y} x2={LABEL_WIDTH + w * weekWidth} y2={y + ROW_HEIGHT}
                    stroke="#e2e8f0" strokeWidth={0.5} />
                ))}

                {/* Label column */}
                <rect x={0} y={y} width={LABEL_WIDTH} height={ROW_HEIGHT} fill={idx % 2 === 0 ? "#f8fafc" : "#f1f5f9"} />
                <line x1={LABEL_WIDTH} y1={y} x2={LABEL_WIDTH} y2={y + ROW_HEIGHT} stroke="#cbd5e1" strokeWidth={1} />

                {/* Trade color swatch */}
                <rect x={8} y={y + (ROW_HEIGHT - 20) / 2} width={4} height={20} rx={2} fill={task.color} />

                {/* Task label */}
                <text x={20} y={y + ROW_HEIGHT / 2 - 3} fontSize={11} fontWeight={task.isMilestone ? "700" : "500"} fill="#1e293b">
                  {task.title.length > 22 ? task.title.slice(0, 21) + "…" : task.title}
                </text>
                <text x={20} y={y + ROW_HEIGHT / 2 + 9} fontSize={9} fill="#94a3b8">{task.trade}</text>

                {/* Row separator */}
                <line x1={0} y1={y + ROW_HEIGHT} x2={totalWidth} y2={y + ROW_HEIGHT} stroke="#e2e8f0" strokeWidth={0.5} />

                {/* Milestone diamond */}
                {task.isMilestone ? (
                  <g transform={`translate(${barX + barW / 2}, ${y + ROW_HEIGHT / 2})`}>
                    <polygon points={`0,-${MILESTONE_SIZE / 2} ${MILESTONE_SIZE / 2},0 0,${MILESTONE_SIZE / 2} -${MILESTONE_SIZE / 2},0`}
                      fill={task.color} stroke="white" strokeWidth={1.5} />
                    <text y={MILESTONE_SIZE / 2 + 11} textAnchor="middle" fontSize={8} fill={task.color} fontWeight="600">
                      {format(addWeeks(projectStart, task.startWeek), "d MMM")}
                    </text>
                  </g>
                ) : (
                  /* Task bar */
                  <g>
                    <rect x={barX + 2} y={barY} width={Math.max(barW - 4, 4)} height={22} rx={5}
                      fill={task.color} opacity={0.85} />
                    {/* Shine */}
                    <rect x={barX + 2} y={barY} width={Math.max(barW - 4, 4)} height={8} rx={5}
                      fill="white" opacity={0.15} />
                    {/* Bar label */}
                    {barW >= 60 && (
                      <text x={barX + barW / 2} y={barY + 14} textAnchor="middle"
                        fontSize={9} fontWeight="600" fill="white" style={{ pointerEvents: "none" }}>
                        {task.durationWeeks}w
                      </text>
                    )}
                    {/* Start date label */}
                    <text x={barX + 4} y={barY - 3} fontSize={8} fill="#64748b">
                      {format(addWeeks(projectStart, task.startWeek), "d MMM")}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Today line */}
          <line x1={LABEL_WIDTH} y1={0} x2={LABEL_WIDTH} y2={chartHeight} stroke="#e2e8f0" strokeWidth={1} />
        </svg>
      </div>
    </div>
  );
}
