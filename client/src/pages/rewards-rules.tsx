import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle, Trophy, Zap, Gift, Crown, Target, Calendar, Clock, XCircle } from "lucide-react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

export default function RewardsRules() {
  const [, setLocation] = useLocation();

  // Fetch dynamic reward configuration
  const { data: config, isLoading } = useQuery({
    queryKey: ["/api/rewards/config"],
    queryFn: async () => {
      const response = await fetch("/api/rewards/config");
      if (!response.ok) {
        throw new Error("Failed to fetch reward configuration");
      }
      return response.json();
    }
  });

  // Show loading state while fetching config
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Use fetched config or fallback values
  const points = config || {
    DAILY_SUBMISSION_POINTS: 10,
    WEEKEND_SUBMISSION_BONUS: 5,
    WEEKLY_COMPLETION_BONUS: 25,
    PERFECT_WEEK_BONUS: 100,
    DAILY_SUBMISSION_WITH_STREAK: 12,
    WEEKEND_SUBMISSION_WITH_STREAK: 18
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
              className="flex items-center gap-2"
              data-testid="button-back"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Rewards System Rules</h1>
              <p className="text-gray-600 dark:text-gray-300">Complete guide to earning points and rewards</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Leave Type Warning */}
        <Card className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-5 w-5" />
              Important: Leave Days & Rewards
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-red-800 dark:text-red-200">
              <p className="font-semibold mb-2">Leave types and their impact on rewards:</p>
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-2">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                    <XCircle className="h-4 w-4" />
                    <span><strong>Sick Leave, Personal Leave, Annual Leave:</strong> No points + breaks streaks</span>
                  </div>
                  <div className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
                    <AlertTriangle className="h-4 w-4" />
                    <span><strong>RDO (Rostered Day Off):</strong> No points but streak continues</span>
                  </div>
                </div>
              </div>
              <p className="mt-3 text-sm">
                <strong>Weekly Bonus Impact:</strong> If any day in your week contains sick leave, personal leave, or annual leave, you won't receive the weekly completion bonus. RDO days don't affect weekly bonuses.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Point Earning System */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Point Earning System
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-blue-600" />
                  <span className="font-semibold">Daily Submission</span>
                </div>
                <p className="text-2xl font-bold text-blue-600 mb-1">{points.DAILY_SUBMISSION_POINTS} points</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">For each timesheet submitted</p>
              </div>
              
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  <span className="font-semibold">Weekend Bonus</span>
                </div>
                <p className="text-2xl font-bold text-green-600 mb-1">+{points.WEEKEND_SUBMISSION_BONUS} points</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">Extra points for weekend work</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Streak System */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-orange-500" />
              Streak Bonuses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-orange-600" />
                <span className="font-semibold">5+ Day Streak</span>
              </div>
              <p className="text-2xl font-bold text-orange-600 mb-1">+{Math.round((points.STREAK_MULTIPLIER - 1) * 100)}% bonus</p>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Extra {Math.round((points.STREAK_MULTIPLIER - 1) * 100)}% points on daily submissions when you have a 5+ day streak
              </p>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Streak Rules:</strong> Streaks continue over weekends (Friday to Monday counts as consecutive). 
                Sick leave, personal leave, and annual leave break your streak. RDO days maintain your streak.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Weekly & Monthly Bonuses */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-500" />
              Weekly & Monthly Bonuses
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <span className="font-semibold">Weekly Completion</span>
                </div>
                <p className="text-2xl font-bold text-purple-600 mb-1">{points.WEEKLY_COMPLETION_BONUS} points</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Complete all 5 weekdays (Monday-Friday) with no sick/personal/annual leave
                </p>
              </div>
              
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="h-4 w-4 text-indigo-600" />
                  <span className="font-semibold">Perfect Week</span>
                </div>
                <p className="text-2xl font-bold text-indigo-600 mb-1">{points.PERFECT_WEEK_BONUS} points</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  Complete all 7 days including weekends with no sick/personal/annual leave
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Achievements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-pink-500" />
              Achievement Badges
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <div className="font-semibold">First Timer</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Your first submission</div>
                  </div>
                  <Badge variant="secondary">25 pts</Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <div className="font-semibold">Week Warrior</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">First perfect week</div>
                  </div>
                  <Badge variant="secondary">75 pts</Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <div className="font-semibold">Streak Master</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Reach 10-day streak</div>
                  </div>
                  <Badge variant="secondary">150 pts</Badge>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <div className="font-semibold">Month Champion</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">First perfect month</div>
                  </div>
                  <Badge variant="secondary">300 pts</Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <div className="font-semibold">Consistency King</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">30-day streak</div>
                  </div>
                  <Badge variant="secondary">500 pts</Badge>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <div className="font-semibold">Weekend Warrior</div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">5 weekend submissions</div>
                  </div>
                  <Badge variant="secondary">100 pts</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
          <CardHeader>
            <CardTitle className="text-green-700 dark:text-green-300">Quick Summary</CardTitle>
          </CardHeader>
          <CardContent className="text-green-800 dark:text-green-200">
            <ul className="space-y-2">
              <li>• Submit timesheets daily to earn points and build streaks</li>
              <li>• Avoid sick/personal/annual leave to maintain streaks and weekly bonuses</li>
              <li>• RDO days don't earn points but won't break your streak</li>
              <li>• Weekend work earns extra points</li>
              <li>• 5+ day streaks give 20% bonus on all daily submissions</li>
              <li>• Complete work weeks (no sick/personal/annual leave) earn substantial bonuses</li>
              <li>• Unlock one-time achievement badges for major milestones</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}