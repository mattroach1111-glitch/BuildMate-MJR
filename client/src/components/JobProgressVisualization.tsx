import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  Calendar, 
  DollarSign, 
  Users, 
  Clock, 
  BarChart3,
  PieChart,
  Target,
  CheckCircle,
  AlertCircle,
  Activity
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend
} from "recharts";
import type { Job, LaborEntry, Material, SubTrade, OtherCost, TipFee } from "@shared/schema";

interface JobProgressVisualizationProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface JobDetails extends Job {
  laborEntries: (LaborEntry & { staff?: { name: string } })[];
  materials: Material[];
  subTrades: SubTrade[];
  otherCosts: OtherCost[];
  tipFees: TipFee[];
}

interface ProgressMetrics {
  completion: number;
  totalCost: number;
  totalHours: number;
  daysElapsed: number;
  estimatedDaysRemaining: number;
  costBreakdown: {
    labor: number;
    materials: number;
    subTrades: number;
    otherCosts: number;
    tipFees: number;
  };
  weeklyProgress: Array<{
    week: string;
    hours: number;
    cost: number;
    completion: number;
  }>;
  staffPerformance: Array<{
    name: string;
    hours: number;
    rate: number;
    efficiency: number;
  }>;
}

const STATUS_COLORS = {
  new_job: "#64748b",
  job_in_progress: "#f59e0b", 
  job_complete: "#10b981",
  ready_for_billing: "#3b82f6",
};

const CHART_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function JobProgressVisualization({ jobId, isOpen, onClose }: JobProgressVisualizationProps) {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch job details
  const { data: jobDetails, isLoading } = useQuery<JobDetails>({
    queryKey: ['/api/jobs', jobId],
    enabled: isOpen && !!jobId,
  });

  // Calculate progress metrics
  const progressMetrics = useMemo(() => {
    if (!jobDetails) return null;

    // Calculate total costs
    const laborCost = jobDetails.laborEntries.reduce((sum, entry) => {
      const rate = parseFloat(entry.hourlyRate);
      const hours = parseFloat(entry.hoursLogged);
      return sum + (rate * hours);
    }, 0);

    const materialsCost = jobDetails.materials.reduce((sum, material) => 
      sum + parseFloat(material.amount), 0);
    
    const subTradesCost = jobDetails.subTrades.reduce((sum, subTrade) => 
      sum + parseFloat(subTrade.amount), 0);
    
    const otherCostsCost = jobDetails.otherCosts.reduce((sum, cost) => 
      sum + parseFloat(cost.amount), 0);
    
    const tipFeesCost = jobDetails.tipFees.reduce((sum, tipFee) => {
      const baseAmount = parseFloat(tipFee.amount);
      const cartage = baseAmount * 0.20; // 20% cartage
      return sum + baseAmount + cartage;
    }, 0);

    const totalCost = laborCost + materialsCost + subTradesCost + otherCostsCost + tipFeesCost;
    const totalHours = jobDetails.laborEntries.reduce((sum, entry) => 
      sum + parseFloat(entry.hoursLogged), 0);

    // Calculate completion percentage based on status
    const completionMap = {
      new_job: 5,
      job_in_progress: 60,
      job_complete: 95,
      ready_for_billing: 100,
    };
    const completion = completionMap[jobDetails.status] || 0;

    // Calculate days elapsed
    const startDate = jobDetails.createdAt ? new Date(jobDetails.createdAt) : new Date();
    const today = new Date();
    const daysElapsed = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Estimate days remaining (simple calculation based on current progress)
    const estimatedDaysRemaining = completion > 0 ? Math.round((daysElapsed * (100 - completion)) / completion) : 30;

    // Generate weekly progress data (mock data for demonstration)
    const weeklyProgress = [];
    for (let i = 0; i < Math.min(8, Math.ceil(daysElapsed / 7) + 1); i++) {
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + (i * 7));
      weeklyProgress.push({
        week: `Week ${i + 1}`,
        hours: Math.round(totalHours * (0.1 + Math.random() * 0.2)),
        cost: Math.round(totalCost * (0.1 + Math.random() * 0.2)),
        completion: Math.min(completion, (i + 1) * (completion / 8)),
      });
    }

    // Calculate staff performance
    const staffMap = new Map();
    jobDetails.laborEntries.forEach(entry => {
      const staffName = entry.staff?.name || 'Unknown';
      const hours = parseFloat(entry.hoursLogged);
      const rate = parseFloat(entry.hourlyRate);
      
      if (staffMap.has(staffName)) {
        const existing = staffMap.get(staffName);
        existing.hours += hours;
        existing.totalCost += (hours * rate);
      } else {
        staffMap.set(staffName, {
          name: staffName,
          hours,
          rate,
          totalCost: hours * rate,
          efficiency: 85 + Math.random() * 30, // Mock efficiency score
        });
      }
    });

    const staffPerformance = Array.from(staffMap.values());

    return {
      completion,
      totalCost,
      totalHours,
      daysElapsed,
      estimatedDaysRemaining,
      costBreakdown: {
        labor: laborCost,
        materials: materialsCost,
        subTrades: subTradesCost,
        otherCosts: otherCostsCost,
        tipFees: tipFeesCost,
      },
      weeklyProgress,
      staffPerformance,
    } as ProgressMetrics;
  }, [jobDetails]);

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-4xl mx-4">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading job progress data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!jobDetails || !progressMetrics) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="w-full max-w-4xl mx-4">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <p className="text-lg font-semibold">Job not found</p>
            <p className="text-muted-foreground">Unable to load job progress data.</p>
            <Button onClick={onClose} className="mt-4">Close</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const costBreakdownData = [
    { name: 'Labor', value: progressMetrics.costBreakdown.labor, color: CHART_COLORS[0] },
    { name: 'Materials', value: progressMetrics.costBreakdown.materials, color: CHART_COLORS[1] },
    { name: 'Sub-trades', value: progressMetrics.costBreakdown.subTrades, color: CHART_COLORS[2] },
    { name: 'Other Costs', value: progressMetrics.costBreakdown.otherCosts, color: CHART_COLORS[3] },
    { name: 'Tip Fees', value: progressMetrics.costBreakdown.tipFees, color: CHART_COLORS[4] },
  ].filter(item => item.value > 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-hidden">
        <CardHeader className="border-b bg-gradient-to-r from-primary/10 to-primary/5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-3">
                <Activity className="h-7 w-7 text-primary" />
                Job Progress Visualization
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                {jobDetails.jobAddress} • {jobDetails.clientName}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                style={{ backgroundColor: STATUS_COLORS[jobDetails.status] }}
                className="text-white"
              >
                {jobDetails.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <Button variant="ghost" size="sm" onClick={onClose}>×</Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-y-auto max-h-[calc(90vh-120px)]">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted/30">
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="costs" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Cost Analysis
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Performance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="p-6 space-y-6">
              {/* Key Metrics Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Completion</p>
                        <p className="text-2xl font-bold">{progressMetrics.completion}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <DollarSign className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Cost</p>
                        <p className="text-2xl font-bold">${progressMetrics.totalCost.toLocaleString()}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded-lg">
                        <Clock className="h-5 w-5 text-orange-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Total Hours</p>
                        <p className="text-2xl font-bold">{progressMetrics.totalHours.toFixed(1)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Calendar className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Days Elapsed</p>
                        <p className="text-2xl font-bold">{progressMetrics.daysElapsed}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Progress Bar */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Overall Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Progress value={progressMetrics.completion} className="h-3" />
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Started {progressMetrics.daysElapsed} days ago</span>
                      <span>
                        {progressMetrics.estimatedDaysRemaining > 0 
                          ? `Estimated ${progressMetrics.estimatedDaysRemaining} days remaining`
                          : 'Project completed'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Cost Breakdown Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Cost Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={costBreakdownData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={120}
                          paddingAngle={5}
                          dataKey="value"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        >
                          {costBreakdownData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Cost']} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="costs" className="p-6 space-y-6">
              {/* Detailed Cost Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Cost Categories</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {costBreakdownData.map((category, index) => (
                        <div key={category.name} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: category.color }}
                            />
                            <span className="font-medium">{category.name}</span>
                          </div>
                          <span className="font-bold">${category.value.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Cost Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={costBreakdownData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, 'Cost']} />
                          <Bar dataKey="value" fill="#3b82f6" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="timeline" className="p-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Weekly Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={progressMetrics.weeklyProgress}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="week" />
                        <YAxis yAxisId="left" />
                        <YAxis yAxisId="right" orientation="right" />
                        <Tooltip />
                        <Legend />
                        <Area 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="completion" 
                          stroke="#10b981" 
                          fill="#10b981"
                          fillOpacity={0.3}
                          name="Completion %"
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="hours" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          name="Hours Worked"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="p-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Staff Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {progressMetrics.staffPerformance.map((staff, index) => (
                      <div key={staff.name} className="p-4 rounded-lg bg-muted/30">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold">{staff.name}</h4>
                          <Badge variant="outline">{staff.hours.toFixed(1)} hours</Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Hourly Rate:</span>
                            <span className="ml-2 font-medium">${staff.rate}/hr</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Efficiency:</span>
                            <span className="ml-2 font-medium">{staff.efficiency.toFixed(0)}%</span>
                          </div>
                        </div>
                        <Progress value={staff.efficiency} className="h-2 mt-3" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}