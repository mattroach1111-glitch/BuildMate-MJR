import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, Flame, Star, TrendingUp, Award, Clock, Target, Zap } from 'lucide-react';
import { format } from 'date-fns';

interface RewardPoints {
  totalPoints: number;
  availablePoints: number;
  currentStreak: number;
  longestStreak: number;
  lastSubmissionDate: string | null;
}

interface RewardTransaction {
  id: string;
  type: 'earned' | 'spent' | 'bonus' | 'penalty';
  points: number;
  reason: string;
  description: string;
  relatedDate: string | null;
  createdAt: string;
  metadata?: any;
}

interface RewardAchievement {
  id: string;
  achievementType: string;
  achievementName: string;
  description: string;
  pointsAwarded: number;
  badgeIcon: string;
  achievedAt: string;
}

interface LeaderboardEntry {
  userId: string;
  firstName: string;
  lastName: string;
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
}

interface RewardsDashboard {
  points: RewardPoints;
  recentTransactions: RewardTransaction[];
  achievements: RewardAchievement[];
  leaderboard: LeaderboardEntry[];
  userRank: number | null;
  totalUsers: number;
}

const RewardsDashboard: React.FC = () => {
  const { data: dashboard, isLoading, error } = useQuery<RewardsDashboard>({
    queryKey: ['/api/rewards/dashboard'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center text-red-600">
          <p>Failed to load rewards dashboard</p>
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return null;
  }

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'earned': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'bonus': return <Star className="h-4 w-4 text-yellow-600" />;
      case 'spent': return <Target className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStreakColor = (streak: number) => {
    if (streak >= 20) return 'text-purple-600 bg-purple-100';
    if (streak >= 10) return 'text-red-600 bg-red-100';
    if (streak >= 5) return 'text-orange-600 bg-orange-100';
    return 'text-blue-600 bg-blue-100';
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="page-title">
          Rewards Dashboard
        </h1>
        <p className="text-gray-600">
          Track your progress and earn rewards for timely timesheet submissions
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card data-testid="card-total-points">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {dashboard.points.totalPoints.toLocaleString()}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              {dashboard.points.availablePoints} available to spend
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-current-streak">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Streak</CardTitle>
            <Flame className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStreakColor(dashboard.points.currentStreak)}`}>
              {dashboard.points.currentStreak} days
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Best: {dashboard.points.longestStreak} days
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-leaderboard-rank">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Rank</CardTitle>
            <Award className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {dashboard.userRank ? `#${dashboard.userRank}` : 'Unranked'}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Out of {dashboard.totalUsers} staff
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-achievements">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Achievements</CardTitle>
            <Zap className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {dashboard.achievements.length}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Badges earned
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">History</TabsTrigger>
          <TabsTrigger value="achievements" data-testid="tab-achievements">Achievements</TabsTrigger>
          <TabsTrigger value="leaderboard" data-testid="tab-leaderboard">Leaderboard</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Progress Towards Next Achievement */}
            <Card data-testid="card-progress">
              <CardHeader>
                <CardTitle className="text-lg">Progress Tracker</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>Next Streak Milestone</span>
                    <span>{dashboard.points.currentStreak}/20 days</span>
                  </div>
                  <Progress 
                    value={(dashboard.points.currentStreak / 20) * 100} 
                    className="h-2"
                  />
                </div>
                
                {dashboard.points.lastSubmissionDate && (
                  <div className="text-sm text-gray-600">
                    Last submission: {format(new Date(dashboard.points.lastSubmissionDate), 'MMM dd, yyyy')}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Recent Achievements */}
            <Card data-testid="card-recent-achievements">
              <CardHeader>
                <CardTitle className="text-lg">Recent Achievements</CardTitle>
              </CardHeader>
              <CardContent>
                {dashboard.achievements.length > 0 ? (
                  <div className="space-y-3">
                    {dashboard.achievements.slice(0, 3).map((achievement) => (
                      <div key={achievement.id} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                        <div className="text-2xl">{achievement.badgeIcon}</div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{achievement.achievementName}</div>
                          <div className="text-xs text-gray-600">{achievement.description}</div>
                          <div className="text-xs text-green-600">+{achievement.pointsAwarded} points</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-4">
                    <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No achievements yet</p>
                    <p className="text-xs">Keep submitting timesheets to earn your first badge!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card data-testid="card-transaction-history">
            <CardHeader>
              <CardTitle className="text-lg">Point History</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.recentTransactions.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {getTransactionIcon(transaction.type)}
                        <div>
                          <div className="font-medium text-sm">{transaction.description}</div>
                          <div className="text-xs text-gray-600">
                            {format(new Date(transaction.createdAt), 'MMM dd, yyyy')}
                            {transaction.relatedDate && ` • ${format(new Date(transaction.relatedDate), 'MMM dd')}`}
                          </div>
                        </div>
                      </div>
                      <div className={`font-bold ${
                        transaction.type === 'spent' ? 'text-red-600' : 'text-green-600'
                      }`}>
                        {transaction.type === 'spent' ? '-' : '+'}{transaction.points}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No transactions yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements" className="space-y-4">
          <Card data-testid="card-all-achievements">
            <CardHeader>
              <CardTitle className="text-lg">All Achievements</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboard.achievements.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dashboard.achievements.map((achievement) => (
                    <div key={achievement.id} className="flex items-center space-x-4 p-4 border rounded-lg bg-gradient-to-r from-yellow-50 to-yellow-100">
                      <div className="text-3xl">{achievement.badgeIcon}</div>
                      <div className="flex-1">
                        <div className="font-semibold">{achievement.achievementName}</div>
                        <div className="text-sm text-gray-600 mb-1">{achievement.description}</div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary" className="text-xs">
                            +{achievement.pointsAwarded} points
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {format(new Date(achievement.achievedAt), 'MMM dd, yyyy')}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Award className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg mb-2">No achievements yet</p>
                  <p className="text-sm">Submit your timesheets consistently to start earning badges!</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-4">
          <Card data-testid="card-leaderboard">
            <CardHeader>
              <CardTitle className="text-lg">Staff Leaderboard</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {dashboard.leaderboard.map((entry, index) => (
                  <div key={entry.userId} className={`flex items-center justify-between p-3 rounded-lg ${
                    index < 3 ? 'bg-gradient-to-r from-yellow-50 to-yellow-100' : 'bg-gray-50'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-600 text-white' :
                        'bg-gray-200 text-gray-700'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-medium">
                          {entry.firstName} {entry.lastName}
                        </div>
                        <div className="text-sm text-gray-600">
                          Current streak: {entry.currentStreak} days
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg text-yellow-600">
                        {entry.totalPoints.toLocaleString()}
                      </div>
                      <div className="text-xs text-gray-600">
                        Best: {entry.longestStreak} days
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RewardsDashboard;