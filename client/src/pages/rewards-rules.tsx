import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, TrendingUp, Gift, Award, AlertCircle, Clock } from 'lucide-react';
import PageLayout from '@/components/page-layout';

interface RewardSettings {
  dailySubmissionPoints: number;
  weeklyBonusPoints: number;
  fortnightlyBonusPoints: number;
  monthlyBonusPoints: number;
}

const RewardsRules: React.FC = () => {
  const { data: settings, isLoading, error } = useQuery<RewardSettings>({
    queryKey: ['/api/rewards/settings'],
    refetchInterval: 2000, // Refetch every 2 seconds
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache at all
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: (failureCount, error: any) => {
      console.log(`Retry attempt ${failureCount} for rewards settings:`, error);
      // Don't retry auth errors, but retry other errors up to 3 times
      if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) {
        console.log('Auth error detected, not retrying');
        return false;
      }
      return failureCount < 3;
    },
  });

  // Debug logging
  React.useEffect(() => {
    console.log('🔍 Rewards Rules Debug - Current state:', {
      isLoading,
      hasError: !!error,
      hasSettings: !!settings,
      errorDetails: error,
      settingsData: settings
    });
    
    if (error) {
      console.error('❌ Rewards Rules - Error loading settings:', error);
      // Try to get more error details
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
    } else if (settings) {
      console.log('✅ Rewards Rules - Current settings received:', settings);
      console.log('📊 Point values:', {
        daily: settings.dailySubmissionPoints,
        weekly: settings.weeklyBonusPoints,
        fortnightly: settings.fortnightlyBonusPoints,
        monthly: settings.monthlyBonusPoints
      });
      console.log('🔄 Triggering rewardTypes recalculation...');
    } else {
      console.log('⏳ Rewards Rules - Waiting for settings...');
    }
  }, [settings, error, isLoading]);

  if (isLoading) {
    return (
      <PageLayout title="Rewards Rules" subtitle="How to earn points and maintain streaks">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </PageLayout>
    );
  }

  if (error) {
    console.error('Rewards rules error:', error);
    return (
      <PageLayout title="Rewards Rules" subtitle="How to earn points and maintain streaks">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600">Unable to load reward settings</p>
            <p className="text-sm text-gray-500 mt-1">Please try refreshing the page</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  const rewardTypes = React.useMemo(() => [
    {
      title: "Daily Rewards",
      points: settings?.dailySubmissionPoints ?? 10,
      description: "Submit your timesheet each working day",
      icon: Calendar,
      color: "bg-blue-50 border-blue-200 text-blue-800",
      requirement: "Submit timesheet by end of day"
    },
    {
      title: "Weekly Rewards", 
      points: settings?.weeklyBonusPoints ?? 50,
      description: "Complete all 5 working days in a week",
      icon: TrendingUp,
      color: "bg-green-50 border-green-200 text-green-800",
      requirement: "Submit Monday to Friday timesheets"
    },
    {
      title: "Fortnightly Rewards",
      points: settings?.fortnightlyBonusPoints ?? 100,
      description: "Complete all working days in a 2-week period",
      icon: Award,
      color: "bg-purple-50 border-purple-200 text-purple-800",
      requirement: "Submit all timesheets for 10 working days"
    },
    {
      title: "Monthly Rewards",
      points: settings?.monthlyBonusPoints ?? 200,
      description: "Complete all working days in a month",
      icon: Gift,
      color: "bg-orange-50 border-orange-200 text-orange-800",
      requirement: "Submit all monthly working day timesheets"
    }
  ], [settings]);

  const streakBreakers = [
    "Sick Leave",
    "Personal Leave", 
    "Annual Leave",
    "Leave without pay"
  ];

  return (
    <PageLayout title="Rewards Rules" subtitle="Simple guide to earning points and maintaining streaks">
      <div className="space-y-6">
        {/* Reward Types */}
        <Card data-testid="card-reward-types">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-blue-600" />
              How to Earn Points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {rewardTypes.map((reward) => {
                const IconComponent = reward.icon;
                return (
                  <div
                    key={reward.title}
                    className={`border rounded-lg p-4 ${reward.color}`}
                    data-testid={`reward-type-${reward.title.toLowerCase().replace(' ', '-')}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" />
                        <h3 className="font-semibold">{reward.title}</h3>
                      </div>
                      <Badge variant="secondary" className="bg-white">
                        {reward.points} pts
                      </Badge>
                    </div>
                    <p className="text-sm mb-2">{reward.description}</p>
                    <p className="text-xs font-medium">
                      Requirement: {reward.requirement}
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Streak Rules */}
        <Card data-testid="card-streak-rules">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              Streak Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">
                  <Clock className="h-4 w-4 inline mr-1" />
                  Maintaining Your Streak
                </h3>
                <p className="text-sm text-green-700">
                  Submit your timesheet every working day to maintain your streak and earn bonus points.
                  Weekends don't count towards or against your streak.
                </p>
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-semibold text-red-800 mb-2">
                  When Streaks Reset
                </h3>
                <p className="text-sm text-red-700 mb-3">
                  Your streak will reset to 0 if you take any of the following leave types:
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {streakBreakers.map((leave) => (
                    <Badge
                      key={leave}
                      variant="destructive"
                      className="bg-red-100 text-red-800 border-red-300"
                      data-testid={`streak-breaker-${leave.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {leave}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-red-600 mt-3">
                  After taking leave, your streak starts fresh from day 1 when you return to work.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card data-testid="card-summary">
          <CardHeader>
            <CardTitle>Quick Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold mb-2 text-green-700">✓ To Earn Points:</h3>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Submit timesheets daily</li>
                  <li>• Complete full working weeks</li>
                  <li>• Maintain consistent attendance</li>
                  <li>• Avoid missing submissions</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-red-700">✗ Streak Resets When:</h3>
                <ul className="text-sm space-y-1 text-gray-600">
                  <li>• Taking sick leave</li>
                  <li>• Taking personal leave</li>
                  <li>• Taking annual leave</li>
                  <li>• Taking unpaid leave</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
};

export default RewardsRules;