import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy, RefreshCw, Calendar, Clock, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function RewardsRules() {
  const [, setLocation] = useLocation();

  // Fetch dynamic reward configuration
  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ["/api/rewards/config"],
    queryFn: async () => {
      const response = await fetch(`/api/rewards/config?t=${Date.now()}`);
      if (!response.ok) {
        throw new Error("Failed to fetch reward configuration");
      }
      return response.json();
    },
    staleTime: 0,
    gcTime: 0
  });

  if (isLoading || !config) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading reward configuration...</p>
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
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rewards System Rules</h1>
              <p className="text-gray-600 dark:text-gray-300">Simple guide to earning points</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="flex items-center gap-2"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        
        {/* Main Rewards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Daily Rewards */}
          <Card className="border-2 border-blue-200 dark:border-blue-800">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-2">
                <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <CardTitle className="text-lg text-blue-700 dark:text-blue-300">Daily Rewards</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                {config.DAILY_POINTS} pts
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                For each timesheet submitted
              </p>
              {config.WEEKEND_BONUS > 0 && (
                <p className="text-xs text-blue-500 mt-2">
                  +{config.WEEKEND_BONUS} bonus on weekends
                </p>
              )}
            </CardContent>
          </Card>

          {/* Weekly Rewards */}
          <Card className="border-2 border-green-200 dark:border-green-800">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-2">
                <Clock className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <CardTitle className="text-lg text-green-700 dark:text-green-300">Weekly Rewards</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                {config.WEEKLY_POINTS} pts
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                For completing a full week
              </p>
            </CardContent>
          </Card>

          {/* Fortnightly Rewards */}
          <Card className="border-2 border-purple-200 dark:border-purple-800">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center mb-2">
                <Trophy className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <CardTitle className="text-lg text-purple-700 dark:text-purple-300">Fortnightly Rewards</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                {config.FORTNIGHTLY_POINTS} pts
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                For completing two weeks
              </p>
            </CardContent>
          </Card>

          {/* Monthly Rewards */}
          <Card className="border-2 border-orange-200 dark:border-orange-800">
            <CardHeader className="text-center pb-3">
              <div className="mx-auto w-12 h-12 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center mb-2">
                <Trophy className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
              <CardTitle className="text-lg text-orange-700 dark:text-orange-300">Monthly Rewards</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                {config.MONTHLY_POINTS} pts
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                For completing a full month
              </p>
            </CardContent>
          </Card>

        </div>

        {/* Streak Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Streak Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                Keep Your Streak Going
              </h3>
              <p className="text-sm text-green-700 dark:text-green-300">
                Submit your timesheets every working day to maintain your streak and earn daily rewards.
                RDOs (Rostered Days Off) will not break your streak but won't earn points either.
              </p>
            </div>
            
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                Streak Breakers
              </h3>
              <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                These leave types will reset your streak to zero:
              </p>
              <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
                <li>Sick Leave</li>
                <li>Personal Leave</li>
                <li>Annual Leave</li>
                <li>Leave Without Pay</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Daily Points</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Earn {config.DAILY_POINTS} points for each timesheet you submit. 
                  {config.WEEKEND_BONUS > 0 && ` Get an extra ${config.WEEKEND_BONUS} points for weekend submissions.`}
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Completion Bonuses</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Complete full periods (week, fortnight, month) to earn bonus points on top of your daily rewards.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}