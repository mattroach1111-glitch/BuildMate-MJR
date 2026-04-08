import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { GanttChart, GanttTask } from "./GanttChart";
import {
  Sparkles, Plus, Trash2, Edit2, Calendar,
  Save, RotateCcw, AlertCircle, Upload, FileText, X
} from "lucide-react";
import { format } from "date-fns";

const TRADES = [
  "Earthworks", "Concrete", "Framing", "Roofing", "Electrical",
  "Plumbing", "HVAC", "Insulation", "Plastering", "Painting",
  "Tiling", "Joinery", "Landscaping", "Site Manager", "Inspections", "General"
];

const TRADE_COLORS: Record<string, string> = {
  'Earthworks': '#92400e', 'Concrete': '#78716c', 'Framing': '#b45309',
  'Roofing': '#1e40af', 'Electrical': '#eab308', 'Plumbing': '#0891b2',
  'HVAC': '#7c3aed', 'Insulation': '#d97706', 'Plastering': '#6b7280',
  'Painting': '#ec4899', 'Tiling': '#14b8a6', 'Joinery': '#f97316',
  'Landscaping': '#16a34a', 'Site Manager': '#dc2626', 'Inspections': '#8b5cf6',
  'General': '#6366f1',
};

interface TimelineData {
  id: string;
  jobId?: string | null;
  title: string;
  startDate: string;
  durationWeeks: number;
  scopeText?: string | null;
  tasks: GanttTask[];
}

interface ProjectSchedulerProps {
  jobId: string;
  jobAddress?: string;
  compact?: boolean;
}

interface TaskForm {
  id?: string;
  title: string;
  trade: string;
  color: string;
  startWeek: number;
  durationWeeks: number;
  isMilestone: boolean;
  notes: string;
  orderIndex: number;
}

const emptyTask = (): TaskForm => ({
  title: "",
  trade: "General",
  color: TRADE_COLORS["General"],
  startWeek: 0,
  durationWeeks: 2,
  isMilestone: false,
  notes: "",
  orderIndex: 0,
});

export function ProjectScheduler({ jobId, jobAddress, compact }: ProjectSchedulerProps) {
  const { toast } = useToast();
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [scopeText, setScopeText] = useState("");
  const [durationInput, setDurationInput] = useState("12");
  const [startDateInput, setStartDateInput] = useState(new Date().toISOString().split("T")[0]);
  const [titleInput, setTitleInput] = useState("Project Timeline");
  const [editingTask, setEditingTask] = useState<TaskForm | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [localTasks, setLocalTasks] = useState<GanttTask[] | null>(null);
  const [localMeta, setLocalMeta] = useState<{ title: string; startDate: string; durationWeeks: number } | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [uploadedPdfBase64, setUploadedPdfBase64] = useState<string | null>(null);
  const [uploadedPdfMimeType, setUploadedPdfMimeType] = useState<string>("application/pdf");
  const [isReading, setIsReading] = useState(false);

  const { data: timeline, isLoading } = useQuery<TimelineData | null>({
    queryKey: ["/api/jobs", jobId, "timeline"],
    queryFn: () => fetch(`/api/jobs/${jobId}/timeline`, { credentials: "include" }).then(r => r.json()),
  });

  const generateMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest("POST", `/api/jobs/${jobId}/timeline/generate`, body).then(r => r.json()),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/project-timelines"] });
      setLocalTasks(null);
      setLocalMeta(null);
      setShowAIPanel(false);
      setUploadedPdfBase64(null);
      setUploadedFileName(null);
      setScopeText("");
      toast({ title: "Timeline generated!", description: `${data?.tasks?.length || 0} tasks created from your scope of works.` });
    },
    onError: (e: any) => toast({ title: "Generation failed", description: e.message, variant: "destructive" }),
  });

  const saveMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest("POST", `/api/jobs/${jobId}/timeline`, body).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/project-timelines"] });
      setLocalTasks(null);
      setLocalMeta(null);
      setShowSetup(false);
      toast({ title: "Timeline saved!" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/jobs/${jobId}/timeline`).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["/api/project-timelines"] });
      setLocalTasks(null);
      setLocalMeta(null);
      toast({ title: "Timeline deleted" });
    },
  });

  const displayTimeline = timeline;
  const displayTasks = localTasks ?? timeline?.tasks ?? [];
  const displayMeta = localMeta ?? (timeline ? {
    title: timeline.title,
    startDate: timeline.startDate,
    durationWeeks: timeline.durationWeeks,
  } : null);

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsReading(true);
    setUploadedFileName(file.name);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setUploadedPdfBase64(base64);
      setUploadedPdfMimeType(file.type || "application/pdf");
      setScopeText("");
      toast({ title: "PDF ready", description: `${file.name} will be sent directly to AI for reading.` });
    } catch {
      toast({ title: "Upload failed", description: "Try copying and pasting the scope manually.", variant: "destructive" });
      setUploadedFileName(null);
    } finally {
      setIsReading(false);
      e.target.value = "";
    }
  }, [toast]);

  const handleGenerate = () => {
    if (!uploadedPdfBase64 && !scopeText.trim()) {
      toast({ title: "Please upload a PDF or paste your scope of works", variant: "destructive" });
      return;
    }
    const payload: any = {
      durationWeeks: parseInt(durationInput) || 12,
      startDate: startDateInput,
      title: titleInput,
    };
    if (uploadedPdfBase64) {
      payload.pdfBase64 = uploadedPdfBase64;
      payload.pdfMimeType = uploadedPdfMimeType;
    } else {
      payload.scopeText = scopeText;
    }
    generateMutation.mutate(payload);
  };

  const handleAddTask = () => {
    setEditingTaskId(null);
    setEditingTask({ ...emptyTask(), orderIndex: displayTasks.length });
  };

  const handleEditTask = (task: GanttTask) => {
    setEditingTaskId(task.id);
    setEditingTask({
      id: task.id,
      title: task.title,
      trade: task.trade,
      color: task.color,
      startWeek: task.startWeek,
      durationWeeks: task.durationWeeks,
      isMilestone: task.isMilestone,
      notes: task.notes || "",
      orderIndex: task.orderIndex,
    });
  };

  const handleSaveTask = () => {
    if (!editingTask || !editingTask.title.trim()) return;
    const taskData: GanttTask = {
      id: editingTaskId || crypto.randomUUID(),
      title: editingTask.title,
      trade: editingTask.trade,
      color: TRADE_COLORS[editingTask.trade] || "#6366f1",
      startWeek: editingTask.startWeek,
      durationWeeks: editingTask.durationWeeks,
      isMilestone: editingTask.isMilestone,
      notes: editingTask.notes,
      orderIndex: editingTask.orderIndex,
    };

    if (editingTaskId) {
      setLocalTasks((displayTasks).map(t => t.id === editingTaskId ? taskData : t));
    } else {
      setLocalTasks([...displayTasks, taskData]);
    }
    setEditingTask(null);
    setEditingTaskId(null);
  };

  const handleDeleteTask = (id: string) => {
    setLocalTasks(displayTasks.filter(t => t.id !== id));
  };

  const handleSaveAll = () => {
    const tasksToSave = localTasks ?? timeline?.tasks ?? [];
    const meta = displayMeta ?? { title: "Project Timeline", startDate: new Date().toISOString().split("T")[0], durationWeeks: 12 };
    saveMutation.mutate({
      ...meta,
      tasks: tasksToSave.map(({ id, ...rest }) => rest),
    });
  };

  const hasUnsavedChanges = localTasks !== null || localMeta !== null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {displayMeta?.title || "Project Timeline"}
          </h3>
          {displayMeta && (
            <p className="text-sm text-gray-500 mt-0.5">
              Starting {format(new Date(displayMeta.startDate), "d MMM yyyy")} · {displayMeta.durationWeeks} weeks
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {hasUnsavedChanges && (
            <>
              <Button variant="outline" size="sm" onClick={() => { setLocalTasks(null); setLocalMeta(null); }} className="gap-1.5 text-gray-600">
                <RotateCcw className="h-4 w-4" /> Discard
              </Button>
              <Button size="sm" onClick={handleSaveAll} disabled={saveMutation.isPending} className="gap-1.5 bg-green-600 hover:bg-green-700 text-white">
                <Save className="h-4 w-4" /> {saveMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </>
          )}
          {displayTimeline && (
            <Button variant="outline" size="sm" onClick={handleAddTask} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Task
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setShowAIPanel(!showAIPanel)}
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Sparkles className="h-4 w-4" />
            {displayTimeline ? "Regenerate with AI" : "Generate with AI"}
          </Button>
          {displayTimeline && (
            <Button variant="outline" size="sm" onClick={() => setShowSetup(!showSetup)} className="gap-1.5 text-gray-600">
              <Edit2 className="h-4 w-4" /> Edit Settings
            </Button>
          )}
        </div>
      </div>

      {/* AI Generation Panel */}
      {showAIPanel && (
        <Card className="border-indigo-200 bg-indigo-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-indigo-800">
              <Sparkles className="h-4 w-4" /> AI Timeline Generator
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Project Start Date</Label>
                <Input type="date" value={startDateInput} onChange={e => setStartDateInput(e.target.value)} className="text-sm" />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Duration (weeks)</Label>
                <Select value={durationInput} onValueChange={setDurationInput}>
                  <SelectTrigger className="text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 48, 52].map(w => (
                      <SelectItem key={w} value={String(w)}>{w} weeks (~{Math.round(w / 4.3)} months)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Timeline Title</Label>
                <Input value={titleInput} onChange={e => setTitleInput(e.target.value)} placeholder="Project Timeline" className="text-sm" />
              </div>
            </div>
            <div className="flex flex-col gap-3">
              {/* PDF Upload — primary method */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium">Upload Scope of Works PDF</Label>
                {uploadedPdfBase64 && uploadedFileName ? (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-green-800 truncate">{uploadedFileName}</p>
                      <p className="text-xs text-green-600">PDF will be sent directly to AI — no text extraction needed</p>
                    </div>
                    <button onClick={() => { setUploadedPdfBase64(null); setUploadedFileName(null); }}
                      className="flex-shrink-0 text-green-400 hover:text-green-700">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className={`flex items-center justify-center gap-2 cursor-pointer border-2 border-dashed rounded-xl px-4 py-5 transition-colors
                    ${isReading ? "border-indigo-300 bg-indigo-50/50 text-indigo-400" : "border-indigo-200 bg-indigo-50/30 text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50"}`}>
                    <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isReading} />
                    {isReading ? (
                      <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-500" /> Reading file…</>
                    ) : (
                      <><Upload className="h-5 w-5" /> <span className="font-medium text-sm">Tap to upload PDF</span></>
                    )}
                  </label>
                )}
              </div>

              {/* Manual scope — secondary/optional */}
              {!uploadedPdfBase64 && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-medium">or type / paste scope manually</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  <Textarea
                    value={scopeText}
                    onChange={e => setScopeText(e.target.value)}
                    placeholder="e.g. Demolish existing structure, excavate and pour new slab, erect timber frame, install metal roofing, complete electrical and plumbing rough-in, insulate and plaster, install kitchen and bathrooms, painting, tiling, landscaping and handover."
                    className="min-h-[100px] text-sm resize-y"
                  />
                </div>
              )}

              <p className="text-xs text-indigo-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> AI reads your full scope and generates a realistic trade-sequenced timeline.
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
                {generateMutation.isPending ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Generating…</>
                ) : (
                  <><Sparkles className="h-4 w-4" /> Generate Timeline</>
                )}
              </Button>
              <Button variant="outline" onClick={() => setShowAIPanel(false)}>Cancel</Button>
            </div>
            {generateMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-indigo-700 bg-indigo-100 rounded-lg px-3 py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-indigo-600" />
                AI is reading your scope and building the timeline…
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Settings Panel */}
      {showSetup && displayTimeline && (
        <Card className="border-gray-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Timeline Settings</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Start Date</Label>
              <Input type="date" defaultValue={displayMeta?.startDate}
                onChange={e => setLocalMeta(m => ({ ...(m ?? displayMeta!), startDate: e.target.value }))} className="text-sm" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Duration (weeks)</Label>
              <Select defaultValue={String(displayMeta?.durationWeeks ?? 12)}
                onValueChange={v => setLocalMeta(m => ({ ...(m ?? displayMeta!), durationWeeks: parseInt(v) }))}>
                <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 48, 52].map(w => (
                    <SelectItem key={w} value={String(w)}>{w} weeks</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Title</Label>
              <Input defaultValue={displayMeta?.title}
                onChange={e => setLocalMeta(m => ({ ...(m ?? displayMeta!), title: e.target.value }))} className="text-sm" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* No timeline yet */}
      {!displayTimeline && !showAIPanel && (
        <Card className="border-dashed border-2 border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
              <Calendar className="h-8 w-8 text-indigo-500" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900 text-lg">No Timeline Yet</h4>
              <p className="text-sm text-gray-500 mt-1 max-w-sm">
                Upload your scope of works and let AI build a professional Gantt chart timeline for this project.
              </p>
            </div>
            <Button onClick={() => setShowAIPanel(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
              <Sparkles className="h-4 w-4" /> Generate Timeline with AI
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Gantt Chart */}
      {displayTasks.length > 0 && displayMeta && (
        <GanttChart
          tasks={displayTasks}
          startDate={displayMeta.startDate}
          durationWeeks={displayMeta.durationWeeks}
          title={displayMeta.title}
          compact={compact}
        />
      )}

      {/* Task list (editable) */}
      {displayTasks.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-gray-700">Tasks ({displayTasks.length})</h4>
            <Button variant="ghost" size="sm" onClick={handleAddTask} className="gap-1.5 text-indigo-600 hover:text-indigo-700">
              <Plus className="h-4 w-4" /> Add Task
            </Button>
          </div>
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            {[...displayTasks].sort((a, b) => a.orderIndex - b.orderIndex).map((task, idx) => (
              <div key={task.id} className={`flex items-center gap-3 px-4 py-3 ${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} border-b border-gray-100 last:border-0`}>
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: task.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-gray-900">{task.title}</span>
                    {task.isMilestone && <Badge variant="outline" className="text-xs text-purple-600 border-purple-300">Milestone</Badge>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-400">
                    <span>{task.trade}</span>
                    <span>·</span>
                    <span>Week {task.startWeek + 1} → {task.startWeek + task.durationWeeks}</span>
                    <span>·</span>
                    <span>{task.durationWeeks}w</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-indigo-600" onClick={() => handleEditTask(task)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-red-600" onClick={() => handleDeleteTask(task.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Delete timeline */}
      {displayTimeline && !hasUnsavedChanges && (
        <div className="flex justify-end pt-2">
          <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50"
            onClick={() => { if (confirm("Delete this timeline?")) deleteMutation.mutate(); }}>
            <Trash2 className="h-4 w-4 mr-1.5" /> Delete Timeline
          </Button>
        </div>
      )}

      {/* Task edit dialog */}
      <Dialog open={!!editingTask} onOpenChange={open => { if (!open) { setEditingTask(null); setEditingTaskId(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTaskId ? "Edit Task" : "Add Task"}</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Task Name</Label>
                <Input value={editingTask.title} onChange={e => setEditingTask(t => t && ({ ...t, title: e.target.value }))}
                  placeholder="e.g. Electrical Rough-In" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Trade</Label>
                  <Select value={editingTask.trade} onValueChange={v => setEditingTask(t => t && ({ ...t, trade: v, color: TRADE_COLORS[v] || "#6366f1" }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRADES.map(trade => (
                        <SelectItem key={trade} value={trade}>
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TRADE_COLORS[trade] }} />
                            {trade}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Start Week</Label>
                  <Input type="number" min={0} max={(displayMeta?.durationWeeks ?? 52) - 1}
                    value={editingTask.startWeek}
                    onChange={e => setEditingTask(t => t && ({ ...t, startWeek: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Duration (weeks)</Label>
                  <Input type="number" min={1} max={52}
                    value={editingTask.durationWeeks}
                    onChange={e => setEditingTask(t => t && ({ ...t, durationWeeks: parseInt(e.target.value) || 1 }))} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Order</Label>
                  <Input type="number" min={0} value={editingTask.orderIndex}
                    onChange={e => setEditingTask(t => t && ({ ...t, orderIndex: parseInt(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editingTask.isMilestone}
                  onCheckedChange={v => setEditingTask(t => t && ({ ...t, isMilestone: v }))} />
                <Label>Mark as Milestone</Label>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Notes (optional)</Label>
                <Textarea value={editingTask.notes}
                  onChange={e => setEditingTask(t => t && ({ ...t, notes: e.target.value }))}
                  placeholder="Any notes or assumptions…" className="text-sm min-h-[70px]" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditingTask(null); setEditingTaskId(null); }}>Cancel</Button>
            <Button onClick={handleSaveTask} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {editingTaskId ? "Save Changes" : "Add Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
