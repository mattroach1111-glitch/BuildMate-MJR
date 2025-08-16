import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Edit, Save, X, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function AdminRewardsSimple() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editedValues, setEditedValues] = useState<any>({});

  // Fetch current configuration
  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ["/api/rewards/config"],
    queryFn: async () => {
      const response = await fetch("/api/rewards/config");
      if (!response.ok) throw new Error("Failed to fetch config");
      return response.json();
    }
  });

  // Update configuration mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (config: any) => {
      return await apiRequest('PUT', '/api/admin/rewards/config', config);
    },
    onSuccess: () => {
      toast({
        title: "Configuration Updated",
        description: "Reward points have been updated successfully",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/rewards/config'] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update configuration",
        variant: "destructive",
      });
    },
  });

  const handleEdit = () => {
    setIsEditing(true);
    setEditedValues({
      DAILY_POINTS: config?.DAILY_POINTS || 10,
      WEEKLY_POINTS: config?.WEEKLY_POINTS || 50,
      FORTNIGHTLY_POINTS: config?.FORTNIGHTLY_POINTS || 120,
      MONTHLY_POINTS: config?.MONTHLY_POINTS || 250,
      WEEKEND_BONUS: config?.WEEKEND_BONUS || 5
    });
  };

  const handleSave = () => {
    updateConfigMutation.mutate(editedValues);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditedValues({});
  };

  if (isLoading || !config) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/admin-dashboard")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rewards Configuration</h1>
              <p className="text-gray-600 dark:text-gray-300">Configure reward point values</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Reward Point Values</CardTitle>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Configure how many points are awarded for each type of reward
                </p>
              </div>
              {!isEditing && (
                <Button onClick={handleEdit} className="flex items-center gap-2">
                  <Edit className="h-4 w-4" />
                  Edit Values
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="daily">Daily Points</Label>
                    <Input
                      id="daily"
                      type="number"
                      value={editedValues.DAILY_POINTS}
                      onChange={(e) => setEditedValues(prev => ({
                        ...prev,
                        DAILY_POINTS: parseInt(e.target.value) || 0
                      }))}
                      className="mt-1"
                      min="0"
                    />
                    <p className="text-xs text-gray-600 mt-1">Points earned for each timesheet submitted</p>
                  </div>

                  <div>
                    <Label htmlFor="weekend">Weekend Bonus</Label>
                    <Input
                      id="weekend"
                      type="number"
                      value={editedValues.WEEKEND_BONUS}
                      onChange={(e) => setEditedValues(prev => ({
                        ...prev,
                        WEEKEND_BONUS: parseInt(e.target.value) || 0
                      }))}
                      className="mt-1"
                      min="0"
                    />
                    <p className="text-xs text-gray-600 mt-1">Extra points for weekend submissions</p>
                  </div>

                  <div>
                    <Label htmlFor="weekly">Weekly Points</Label>
                    <Input
                      id="weekly"
                      type="number"
                      value={editedValues.WEEKLY_POINTS}
                      onChange={(e) => setEditedValues(prev => ({
                        ...prev,
                        WEEKLY_POINTS: parseInt(e.target.value) || 0
                      }))}
                      className="mt-1"
                      min="0"
                    />
                    <p className="text-xs text-gray-600 mt-1">Bonus for completing a full week</p>
                  </div>

                  <div>
                    <Label htmlFor="fortnightly">Fortnightly Points</Label>
                    <Input
                      id="fortnightly"
                      type="number"
                      value={editedValues.FORTNIGHTLY_POINTS}
                      onChange={(e) => setEditedValues(prev => ({
                        ...prev,
                        FORTNIGHTLY_POINTS: parseInt(e.target.value) || 0
                      }))}
                      className="mt-1"
                      min="0"
                    />
                    <p className="text-xs text-gray-600 mt-1">Bonus for completing two weeks</p>
                  </div>

                  <div className="md:col-span-2">
                    <Label htmlFor="monthly">Monthly Points</Label>
                    <Input
                      id="monthly"
                      type="number"
                      value={editedValues.MONTHLY_POINTS}
                      onChange={(e) => setEditedValues(prev => ({
                        ...prev,
                        MONTHLY_POINTS: parseInt(e.target.value) || 0
                      }))}
                      className="mt-1"
                      min="0"
                    />
                    <p className="text-xs text-gray-600 mt-1">Bonus for completing a full month</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    onClick={handleSave}
                    disabled={updateConfigMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {updateConfigMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    className="flex items-center gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {config.DAILY_POINTS} pts
                  </div>
                  <div className="text-sm text-blue-800 dark:text-blue-300">Daily Points</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Per timesheet submitted</div>
                </div>

                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {config.WEEKEND_BONUS} pts
                  </div>
                  <div className="text-sm text-green-800 dark:text-green-300">Weekend Bonus</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Extra for weekends</div>
                </div>

                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {config.WEEKLY_POINTS} pts
                  </div>
                  <div className="text-sm text-purple-800 dark:text-purple-300">Weekly Bonus</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Full week completion</div>
                </div>

                <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {config.FORTNIGHTLY_POINTS} pts
                  </div>
                  <div className="text-sm text-orange-800 dark:text-orange-300">Fortnightly Bonus</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Two week completion</div>
                </div>

                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 md:col-span-2">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {config.MONTHLY_POINTS} pts
                  </div>
                  <div className="text-sm text-red-800 dark:text-red-300">Monthly Bonus</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Full month completion</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}