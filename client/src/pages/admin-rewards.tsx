import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Settings, Gift, Trophy, Users, TrendingUp, Edit, Trash2, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import PageLayout from '@/components/page-layout';

interface RewardSettings {
  dailySubmissionPoints: number;
  weeklyBonusPoints: number;
  monthlyBonusPoints: number;
  streakBonusMultiplier: number;
  perfectWeekBonus: number;
  perfectMonthBonus: number;
}

interface Prize {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  category: 'gift_card' | 'time_off' | 'merchandise' | 'experience' | 'other';
  imageUrl?: string;
  isActive: boolean;
  stockQuantity?: number;
  createdAt: string;
}

interface RewardRule {
  id: string;
  ruleType: 'daily_timesheet' | 'weekly_timesheet' | 'fortnight_timesheet';
  name: string;
  description: string;
  pointsAwarded: number;
  timeDeadline: string;
  dayDeadline?: string;
  isActive: boolean;
  createdAt: string;
}

interface AdminRewardsData {
  settings: RewardSettings;
  prizes: Prize[];
  totalPointsAwarded: number;
  totalRedemptions: number;
  activeUsers: number;
  topPerformers: Array<{
    userId: string;
    firstName: string;
    lastName: string;
    totalPoints: number;
    currentStreak: number;
  }>;
}

const AdminRewards: React.FC = () => {
  const { toast } = useToast();
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [editedSettings, setEditedSettings] = useState<RewardSettings | null>(null);
  const [showAddPrize, setShowAddPrize] = useState(false);
  const [newPrize, setNewPrize] = useState({
    title: '',
    description: '',
    pointsCost: 0,
    category: 'gift_card' as const,
    stockQuantity: 1
  });
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({
    ruleType: 'daily_timesheet' as const,
    name: '',
    description: '',
    pointsAwarded: 10,
    timeDeadline: '17:00',
    dayDeadline: ''
  });

  const { data: adminData, isLoading, refetch } = useQuery<AdminRewardsData>({
    queryKey: ['/api/admin/rewards/dashboard'],
    refetchInterval: 30000,
  });

  const { data: rewardRules, refetch: refetchRules } = useQuery<RewardRule[]>({
    queryKey: ['/api/admin/rewards/rules'],
    refetchInterval: 30000,
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: RewardSettings) => {
      return await apiRequest('PUT', '/api/admin/rewards/settings', settings);
    },
    onSuccess: () => {
      toast({
        title: "Settings Updated",
        description: "Reward settings have been updated successfully",
      });
      setIsEditingSettings(false);
      refetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update settings",
        variant: "destructive",
      });
    },
  });

  const addPrizeMutation = useMutation({
    mutationFn: async (prize: any) => {
      return await apiRequest('POST', '/api/admin/rewards/prizes', prize);
    },
    onSuccess: () => {
      toast({
        title: "Prize Added",
        description: "New prize has been added to the catalog",
      });
      setShowAddPrize(false);
      setNewPrize({
        title: '',
        description: '',
        pointsCost: 0,
        category: 'gift_card',
        stockQuantity: 1
      });
      refetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add prize",
        variant: "destructive",
      });
    },
  });

  const deletePrizeMutation = useMutation({
    mutationFn: async (prizeId: string) => {
      return await apiRequest('DELETE', `/api/admin/rewards/prizes/${prizeId}`);
    },
    onSuccess: () => {
      toast({
        title: "Prize Deleted",
        description: "Prize has been removed from the catalog",
      });
      refetch();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete prize",
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    if (editedSettings) {
      updateSettingsMutation.mutate(editedSettings);
    }
  };

  const addRuleMutation = useMutation({
    mutationFn: async (rule: any) => {
      return await apiRequest('POST', '/api/admin/rewards/rules', rule);
    },
    onSuccess: () => {
      toast({
        title: "Rule Added",
        description: "New reward rule has been added",
      });
      setShowAddRule(false);
      setNewRule({
        ruleType: 'daily_timesheet',
        name: '',
        description: '',
        pointsAwarded: 10,
        timeDeadline: '17:00',
        dayDeadline: ''
      });
      refetchRules();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add reward rule",
        variant: "destructive",
      });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      return await apiRequest('DELETE', `/api/admin/rewards/rules/${ruleId}`);
    },
    onSuccess: () => {
      toast({
        title: "Rule Deleted",
        description: "Reward rule has been removed",
      });
      refetchRules();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete reward rule",
        variant: "destructive",
      });
    },
  });

  const handleAddPrize = () => {
    if (!newPrize.title || !newPrize.description || newPrize.pointsCost <= 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    addPrizeMutation.mutate(newPrize);
  };

  const handleAddRule = () => {
    if (!newRule.name || !newRule.description || newRule.pointsAwarded <= 0) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    addRuleMutation.mutate(newRule);
  };

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'gift_card': return 'bg-green-100 text-green-800';
      case 'time_off': return 'bg-blue-100 text-blue-800';
      case 'merchandise': return 'bg-purple-100 text-purple-800';
      case 'experience': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <PageLayout title="Rewards Management" subtitle="Configure rewards system and manage prizes">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    );
  }

  if (!adminData) {
    return (
      <PageLayout title="Rewards Management" subtitle="Configure rewards system and manage prizes">
        <div className="text-center text-red-600">
          <p>Failed to load rewards management data</p>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Rewards Management" subtitle="Configure rewards system and manage prizes">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card data-testid="card-total-points">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Points Awarded</CardTitle>
              <Trophy className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {adminData.totalPointsAwarded.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-redemptions">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Redemptions</CardTitle>
              <Gift className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {adminData.totalRedemptions}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-active-users">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {adminData.activeUsers}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-prizes">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Available Prizes</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {adminData.prizes.filter(p => p.isActive).length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="settings" data-testid="tab-settings">Point Settings</TabsTrigger>
            <TabsTrigger value="prizes" data-testid="tab-prizes">Prize Catalog</TabsTrigger>
            <TabsTrigger value="rules" data-testid="tab-rules">Reward Rules</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <Card data-testid="card-point-settings">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Point Calculation Settings</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Configure how points are awarded for different activities
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsEditingSettings(!isEditingSettings);
                    setEditedSettings(adminData.settings);
                  }}
                  data-testid="button-edit-settings"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  {isEditingSettings ? 'Cancel' : 'Edit Settings'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {isEditingSettings ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <Label htmlFor="dailyPoints">Daily Submission Points</Label>
                      <Input
                        id="dailyPoints"
                        type="number"
                        value={editedSettings?.dailySubmissionPoints || 0}
                        onChange={(e) => setEditedSettings(prev => prev ? {
                          ...prev,
                          dailySubmissionPoints: parseInt(e.target.value) || 0
                        } : null)}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-600 mt-1">Points awarded for each daily timesheet submission</p>
                    </div>

                    <div>
                      <Label htmlFor="weeklyPoints">Weekly Bonus Points</Label>
                      <Input
                        id="weeklyPoints"
                        type="number"
                        value={editedSettings?.weeklyBonusPoints || 0}
                        onChange={(e) => setEditedSettings(prev => prev ? {
                          ...prev,
                          weeklyBonusPoints: parseInt(e.target.value) || 0
                        } : null)}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-600 mt-1">Bonus points for completing a full work week</p>
                    </div>

                    <div>
                      <Label htmlFor="monthlyPoints">Monthly Bonus Points</Label>
                      <Input
                        id="monthlyPoints"
                        type="number"
                        value={editedSettings?.monthlyBonusPoints || 0}
                        onChange={(e) => setEditedSettings(prev => prev ? {
                          ...prev,
                          monthlyBonusPoints: parseInt(e.target.value) || 0
                        } : null)}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-600 mt-1">Bonus points for consistent monthly submissions</p>
                    </div>

                    <div>
                      <Label htmlFor="streakMultiplier">Streak Bonus Multiplier</Label>
                      <Input
                        id="streakMultiplier"
                        type="number"
                        step="0.1"
                        value={editedSettings?.streakBonusMultiplier || 0}
                        onChange={(e) => setEditedSettings(prev => prev ? {
                          ...prev,
                          streakBonusMultiplier: parseFloat(e.target.value) || 0
                        } : null)}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-600 mt-1">Multiplier applied to daily points for streaks (e.g., 1.5 = 50% bonus)</p>
                    </div>

                    <div>
                      <Label htmlFor="perfectWeek">Perfect Week Bonus</Label>
                      <Input
                        id="perfectWeek"
                        type="number"
                        value={editedSettings?.perfectWeekBonus || 0}
                        onChange={(e) => setEditedSettings(prev => prev ? {
                          ...prev,
                          perfectWeekBonus: parseInt(e.target.value) || 0
                        } : null)}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-600 mt-1">Extra points for submitting every day of the week</p>
                    </div>

                    <div>
                      <Label htmlFor="perfectMonth">Perfect Month Bonus</Label>
                      <Input
                        id="perfectMonth"
                        type="number"
                        value={editedSettings?.perfectMonthBonus || 0}
                        onChange={(e) => setEditedSettings(prev => prev ? {
                          ...prev,
                          perfectMonthBonus: parseInt(e.target.value) || 0
                        } : null)}
                        className="mt-1"
                      />
                      <p className="text-xs text-gray-600 mt-1">Extra points for perfect attendance all month</p>
                    </div>

                    <div className="md:col-span-2 flex gap-3">
                      <Button
                        onClick={handleSaveSettings}
                        disabled={updateSettingsMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="button-save-settings"
                      >
                        {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setIsEditingSettings(false);
                          setEditedSettings(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{adminData.settings.dailySubmissionPoints}</div>
                      <div className="text-sm text-blue-800">Daily Submission Points</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{adminData.settings.weeklyBonusPoints}</div>
                      <div className="text-sm text-green-800">Weekly Bonus Points</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <div className="text-2xl font-bold text-purple-600">{adminData.settings.perfectWeekBonus}</div>
                      <div className="text-sm text-purple-800">Perfect Week Bonus</div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prizes">
            <Card data-testid="card-prize-catalog">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Prize Catalog</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage rewards that staff can redeem with their points
                  </p>
                </div>
                <Dialog open={showAddPrize} onOpenChange={setShowAddPrize}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-prize">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Prize
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Prize</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="prizeTitle">Prize Title *</Label>
                        <Input
                          id="prizeTitle"
                          placeholder="e.g., $50 Gift Card"
                          value={newPrize.title}
                          onChange={(e) => setNewPrize(prev => ({ ...prev, title: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="prizeDescription">Description *</Label>
                        <Textarea
                          id="prizeDescription"
                          placeholder="Describe the prize and any conditions..."
                          value={newPrize.description}
                          onChange={(e) => setNewPrize(prev => ({ ...prev, description: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="prizeCost">Points Cost *</Label>
                        <Input
                          id="prizeCost"
                          type="number"
                          placeholder="100"
                          value={newPrize.pointsCost || ''}
                          onChange={(e) => setNewPrize(prev => ({ ...prev, pointsCost: parseInt(e.target.value) || 0 }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="prizeCategory">Category</Label>
                        <select
                          id="prizeCategory"
                          value={newPrize.category}
                          onChange={(e) => setNewPrize(prev => ({ ...prev, category: e.target.value as any }))}
                          className="mt-1 w-full p-2 border rounded-md"
                        >
                          <option value="gift_card">Gift Card</option>
                          <option value="time_off">Time Off</option>
                          <option value="merchandise">Merchandise</option>
                          <option value="experience">Experience</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="prizeStock">Stock Quantity (optional)</Label>
                        <Input
                          id="prizeStock"
                          type="number"
                          placeholder="1"
                          value={newPrize.stockQuantity || ''}
                          onChange={(e) => setNewPrize(prev => ({ ...prev, stockQuantity: parseInt(e.target.value) || 1 }))}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex gap-3 pt-4">
                        <Button
                          onClick={handleAddPrize}
                          disabled={addPrizeMutation.isPending}
                          className="flex-1"
                        >
                          {addPrizeMutation.isPending ? "Adding..." : "Add Prize"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowAddPrize(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {adminData.prizes.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {adminData.prizes.map((prize) => (
                      <div key={prize.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{prize.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">{prize.description}</p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Prize</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{prize.title}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deletePrizeMutation.mutate(prize.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge className={getCategoryBadgeColor(prize.category)}>
                            {prize.category.replace('_', ' ')}
                          </Badge>
                          <div className="text-lg font-bold text-blue-600">
                            {prize.pointsCost} pts
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>Stock: {prize.stockQuantity || 'Unlimited'}</span>
                          <span>Active: {prize.isActive ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Gift className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No prizes added yet</p>
                    <p className="text-sm text-gray-500">Add your first prize to get started</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rules">
            <Card data-testid="card-reward-rules">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Reward Rules</CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    Configure time-based rules for point awarding
                  </p>
                </div>
                <Dialog open={showAddRule} onOpenChange={setShowAddRule}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-rule">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Rule
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Reward Rule</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="ruleType">Rule Type *</Label>
                        <select
                          id="ruleType"
                          value={newRule.ruleType}
                          onChange={(e) => setNewRule(prev => ({ ...prev, ruleType: e.target.value as any }))}
                          className="mt-1 w-full p-2 border rounded-md"
                        >
                          <option value="daily_timesheet">Daily Timesheet</option>
                          <option value="fortnight_timesheet">Fortnightly Timesheet</option>
                          <option value="weekly_timesheet">Weekly Timesheet</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="ruleName">Rule Name *</Label>
                        <Input
                          id="ruleName"
                          placeholder="e.g., Daily Submission by 5 PM"
                          value={newRule.name}
                          onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="ruleDescription">Description *</Label>
                        <Textarea
                          id="ruleDescription"
                          placeholder="Describe when this rule applies..."
                          value={newRule.description}
                          onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="rulePoints">Points Awarded *</Label>
                        <Input
                          id="rulePoints"
                          type="number"
                          placeholder="10"
                          value={newRule.pointsAwarded || ''}
                          onChange={(e) => setNewRule(prev => ({ ...prev, pointsAwarded: parseInt(e.target.value) || 0 }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="timeDeadline">Time Deadline (24hr format) *</Label>
                        <Input
                          id="timeDeadline"
                          placeholder="17:00"
                          value={newRule.timeDeadline}
                          onChange={(e) => setNewRule(prev => ({ ...prev, timeDeadline: e.target.value }))}
                          className="mt-1"
                        />
                      </div>
                      {(newRule.ruleType === 'weekly_timesheet' || newRule.ruleType === 'fortnight_timesheet') && (
                        <div>
                          <Label htmlFor="dayDeadline">Day Deadline (optional)</Label>
                          <select
                            id="dayDeadline"
                            value={newRule.dayDeadline}
                            onChange={(e) => setNewRule(prev => ({ ...prev, dayDeadline: e.target.value }))}
                            className="mt-1 w-full p-2 border rounded-md"
                          >
                            <option value="">No specific day</option>
                            <option value="monday">Monday</option>
                            <option value="tuesday">Tuesday</option>
                            <option value="wednesday">Wednesday</option>
                            <option value="thursday">Thursday</option>
                            <option value="friday">Friday</option>
                            <option value="saturday">Saturday</option>
                            <option value="sunday">Sunday</option>
                          </select>
                        </div>
                      )}
                      <div className="flex gap-3 pt-4">
                        <Button
                          onClick={handleAddRule}
                          disabled={addRuleMutation.isPending}
                          className="flex-1"
                        >
                          {addRuleMutation.isPending ? "Adding..." : "Add Rule"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowAddRule(false)}
                          className="flex-1"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {rewardRules && rewardRules.length > 0 ? (
                  <div className="space-y-4">
                    {rewardRules.map((rule) => (
                      <div key={rule.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold">{rule.name}</h3>
                            <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                          </div>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{rule.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteRuleMutation.mutate(rule.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="font-medium">Type:</span> {rule.ruleType.replace('_', ' ')}
                          </div>
                          <div>
                            <span className="font-medium">Points:</span> {rule.pointsAwarded}
                          </div>
                          <div>
                            <span className="font-medium">Time Deadline:</span> {rule.timeDeadline}
                          </div>
                          {rule.dayDeadline && (
                            <div>
                              <span className="font-medium">Day:</span> {rule.dayDeadline}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <Badge className={rule.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Settings className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-600">No reward rules configured</p>
                    <p className="text-sm text-gray-500">Add your first rule to set up time-based point awarding</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics">
            <Card data-testid="card-top-performers">
              <CardHeader>
                <CardTitle className="text-lg">Top Performers</CardTitle>
                <p className="text-sm text-gray-600">
                  Staff members with the highest point totals
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {adminData.topPerformers.map((performer, index) => (
                    <div key={performer.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-yellow-500 text-white' :
                          index === 1 ? 'bg-gray-400 text-white' :
                          index === 2 ? 'bg-orange-600 text-white' :
                          'bg-gray-200 text-gray-700'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-medium">
                            {performer.firstName} {performer.lastName}
                          </div>
                          <div className="text-sm text-gray-600">
                            Current streak: {performer.currentStreak} days
                          </div>
                        </div>
                      </div>
                      <div className="text-lg font-bold text-yellow-600">
                        {performer.totalPoints.toLocaleString()} pts
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
};

export default AdminRewards;