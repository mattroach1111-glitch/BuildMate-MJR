import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GanttChart } from "@/components/GanttChart";
import { ArrowLeft, Calendar, BarChart3, Search, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface TimelineData {
  id: string;
  jobId?: string | null;
  title: string;
  startDate: string;
  durationWeeks: number;
  jobAddress?: string;
  tasks: any[];
}

export default function ProjectPlanner() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: timelines = [], isLoading } = useQuery<TimelineData[]>({
    queryKey: ["/api/project-timelines"],
    queryFn: () => fetch("/api/project-timelines", { credentials: "include" }).then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (jobId: string) => apiRequest("DELETE", `/api/jobs/${jobId}/timeline`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/project-timelines"] });
      setConfirmDeleteId(null);
      if (expanded) setExpanded(null);
      toast({ title: "Timeline deleted" });
    },
    onError: () => toast({ title: "Failed to delete timeline", variant: "destructive" }),
  });

  const filtered = timelines.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.jobAddress || "").toLowerCase().includes(search.toLowerCase())
  );

  const totalTasks = timelines.reduce((sum, t) => sum + t.tasks.length, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-gray-600">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-indigo-600" /> Project Planner
            </h1>
            <p className="text-sm text-gray-500">AI-generated Gantt timelines across all projects</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="hidden sm:inline">{timelines.length} timelines · {totalTasks} tasks</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search timelines…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <Card className="border-dashed border-2 border-gray-200">
            <CardContent className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
                <Calendar className="h-8 w-8 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">No timelines yet</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-sm">
                  Open any job sheet and use the Timeline tab to generate your first project schedule with AI.
                </p>
              </div>
              <Link href="/jobs">
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">Browse Jobs</Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Timeline cards */}
        <div className="flex flex-col gap-4">
          {filtered.map(timeline => (
            <Card key={timeline.id} className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-0">
                <button
                  className="w-full flex items-start justify-between gap-3 text-left"
                  onClick={() => setExpanded(expanded === timeline.id ? null : timeline.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900">{timeline.title}</span>
                      {timeline.jobAddress && (
                        <Badge variant="outline" className="text-xs text-gray-500">{timeline.jobAddress}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(timeline.startDate), "d MMM yyyy")}
                      </span>
                      <span>·</span>
                      <span>{timeline.durationWeeks} weeks</span>
                      <span>·</span>
                      <span>{timeline.tasks.length} tasks</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
                    {timeline.jobId && (
                      <Link href={`/jobs`} onClick={e => e.stopPropagation()}>
                        <Button variant="outline" size="sm" className="text-xs gap-1">Open Job</Button>
                      </Link>
                    )}
                    {confirmDeleteId === timeline.id ? (
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <span className="text-xs text-red-600 font-medium">Delete?</span>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="h-7 text-xs px-2"
                          disabled={deleteMutation.isPending}
                          onClick={() => timeline.jobId && deleteMutation.mutate(timeline.jobId)}
                        >
                          {deleteMutation.isPending ? "…" : "Yes"}
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs px-2"
                          onClick={() => setConfirmDeleteId(null)}>
                          No
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(timeline.id); }}
                        className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete timeline"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    {expanded === timeline.id
                      ? <ChevronDown className="h-5 w-5 text-gray-400" />
                      : <ChevronRight className="h-5 w-5 text-gray-400" />
                    }
                  </div>
                </button>
              </CardHeader>

              {expanded === timeline.id && timeline.tasks.length > 0 && (
                <CardContent className="pt-4">
                  {/* Trade summary */}
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {Array.from(new Set(timeline.tasks.map((t: any) => t.trade))).map(trade => {
                      const task = timeline.tasks.find((t: any) => t.trade === trade)!;
                      return (
                        <Badge key={trade as string} style={{ backgroundColor: (task as any).color + "22", color: (task as any).color, borderColor: (task as any).color + "44" }}
                          variant="outline" className="text-xs">
                          <span className="w-2 h-2 rounded-full mr-1" style={{ backgroundColor: (task as any).color, display: "inline-block" }} />
                          {trade as string}
                        </Badge>
                      );
                    })}
                  </div>
                  <GanttChart
                    tasks={timeline.tasks}
                    startDate={timeline.startDate}
                    durationWeeks={timeline.durationWeeks}
                    title={timeline.title}
                    compact
                  />
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
