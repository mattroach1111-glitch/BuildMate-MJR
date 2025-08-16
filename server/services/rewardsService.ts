import { db } from "../db";
import { 
  rewardPoints, 
  rewardTransactions, 
  rewardAchievements,
  rewardCatalog,
  timesheetEntries,
  users,
  type InsertRewardPoints,
  type InsertRewardTransaction,
  type InsertRewardAchievement,
  type RewardPoints,
  type RewardTransaction,
  type RewardAchievement
} from "@shared/schema";
import { eq, and, gte, lte, desc, asc, sum, count } from "drizzle-orm";
import { format, subDays, startOfDay, endOfDay, isWeekend, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";

// =============================================================================
// REWARD CONFIGURATION
// =============================================================================

let REWARD_CONFIG = {
  DAILY_SUBMISSION_POINTS: 10,
  WEEKEND_SUBMISSION_BONUS: 5, // Extra points for weekend submissions
  WEEKLY_COMPLETION_BONUS: 25, // Bonus for completing all 5 weekdays
  PERFECT_WEEK_BONUS: 100, // Bonus for completing all 7 days including weekends
  STREAK_MULTIPLIER: 1.2, // 20% bonus for streaks >= 5 days
  
  // Achievement thresholds
  ACHIEVEMENTS: {
    STREAK_5: { points: 50, name: "5-Day Streak", icon: "🔥", description: "Submitted timesheets for 5 consecutive days" },
    STREAK_10: { points: 100, name: "10-Day Streak", icon: "⚡", description: "Submitted timesheets for 10 consecutive days" },
    STREAK_20: { points: 200, name: "20-Day Streak", icon: "💪", description: "Submitted timesheets for 20 consecutive days" },
    PERFECT_WEEK: { points: 75, name: "Perfect Week", icon: "⭐", description: "Submitted all weekday timesheets in a week" },
    PERFECT_MONTH: { points: 300, name: "Perfect Month", icon: "👑", description: "Submitted all weekday timesheets in a month" },
    EARLY_BIRD: { points: 30, name: "Early Bird", icon: "🌅", description: "Submitted timesheet before 9 AM" },
    WEEKEND_WARRIOR: { points: 40, name: "Weekend Warrior", icon: "⚔️", description: "Submitted 5 weekend timesheets" }
  }
};

// =============================================================================
// CORE REWARDS SERVICE CLASS
// =============================================================================

export class RewardsService {
  // Get current reward configuration for display in rules/admin
  getRewardConfiguration() {
    return {
      ...REWARD_CONFIG,
      // Calculate derived values for display
      DAILY_SUBMISSION_WITH_STREAK: Math.round(REWARD_CONFIG.DAILY_SUBMISSION_POINTS * REWARD_CONFIG.STREAK_MULTIPLIER),
      WEEKEND_SUBMISSION_WITH_STREAK: Math.round((REWARD_CONFIG.DAILY_SUBMISSION_POINTS + REWARD_CONFIG.WEEKEND_SUBMISSION_BONUS) * REWARD_CONFIG.STREAK_MULTIPLIER)
    };
  }

  // Update reward configuration (for admin use)
  updateRewardConfiguration(updates: Partial<typeof REWARD_CONFIG>) {
    REWARD_CONFIG = { ...REWARD_CONFIG, ...updates };
    return this.getRewardConfiguration();
  }
  
  // Initialize user's reward points record
  async initializeUserRewards(userId: string): Promise<RewardPoints> {
    const existingPoints = await this.getUserRewardPoints(userId);
    if (existingPoints) {
      return existingPoints;
    }

    const newRewardPoints: InsertRewardPoints = {
      userId,
      totalPoints: 0,
      spentPoints: 0,
      availablePoints: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastSubmissionDate: null
    };

    const [created] = await db.insert(rewardPoints).values(newRewardPoints).returning();
    return created;
  }

  // Get user's current reward points
  async getUserRewardPoints(userId: string): Promise<RewardPoints | null> {
    const [points] = await db
      .select()
      .from(rewardPoints)
      .where(eq(rewardPoints.userId, userId));
    
    return points || null;
  }

  // Process timesheet submission for rewards
  async processTimesheetSubmission(userId: string, submissionDate: string, timesheetEntries?: any[]): Promise<{
    pointsEarned: number;
    newStreak: number;
    achievements: RewardAchievement[];
    description: string;
  }> {
    console.log(`Processing timesheet submission rewards for user ${userId} on ${submissionDate}`);
    
    // Check if any timesheet entries for this date contain leave types that break streaks/bonuses
    // Note: RDO days still don't earn points, but don't break streaks
    const hasLeaveType = await this.checkForLeaveTypes(userId, submissionDate);
    const hasRDO = await this.checkForRDO(userId, submissionDate);
    
    if (hasRDO) {
      console.log(`🚫 No rewards for ${userId} on ${submissionDate} - RDO day (no points but streak continues)`);
      return {
        pointsEarned: 0,
        newStreak: await this.calculateNewStreak(userId, submissionDate, (await this.getUserRewardPoints(userId))?.lastSubmissionDate || null),
        achievements: [],
        description: "No points awarded - RDO day (streak maintained)"
      };
    }
    
    if (hasLeaveType) {
      console.log(`🚫 No rewards for ${userId} on ${submissionDate} - contains leave type that breaks streaks`);
      return {
        pointsEarned: 0,
        newStreak: 0,
        achievements: [],
        description: "No points awarded - leave days break streaks and bonuses"
      };
    }
    
    // Initialize user rewards if needed
    await this.initializeUserRewards(userId);
    
    const currentPoints = await this.getUserRewardPoints(userId);
    if (!currentPoints) throw new Error("Failed to initialize user rewards");

    const submissionDateObj = new Date(submissionDate);
    const isWeekendSubmission = isWeekend(submissionDateObj);
    
    // Calculate base points
    let pointsEarned = REWARD_CONFIG.DAILY_SUBMISSION_POINTS;
    let description = "Daily timesheet submission";
    
    // Weekend bonus
    if (isWeekendSubmission) {
      pointsEarned += REWARD_CONFIG.WEEKEND_SUBMISSION_BONUS;
      description += " (weekend bonus)";
    }
    
    // Calculate new streak (consider leave types)
    const newStreak = await this.calculateNewStreak(userId, submissionDate, currentPoints.lastSubmissionDate);
    
    // Streak bonus (20% extra for streaks >= 5)
    if (newStreak >= 5) {
      const streakBonus = Math.floor(pointsEarned * (REWARD_CONFIG.STREAK_MULTIPLIER - 1));
      pointsEarned += streakBonus;
      description += ` (streak bonus: ${streakBonus} pts)`;
    }

    // Record the transaction
    await this.addRewardTransaction({
      userId,
      type: "earned",
      points: pointsEarned,
      reason: "daily_submission",
      description,
      relatedDate: submissionDate,
      metadata: { 
        streak: newStreak, 
        isWeekend: isWeekendSubmission,
        submissionTime: new Date().toISOString()
      }
    });

    // Update user's points and streak
    const newTotalPoints = currentPoints.totalPoints + pointsEarned;
    const newAvailablePoints = currentPoints.availablePoints + pointsEarned;
    const newLongestStreak = Math.max(currentPoints.longestStreak, newStreak);

    await db
      .update(rewardPoints)
      .set({
        totalPoints: newTotalPoints,
        availablePoints: newAvailablePoints,
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastSubmissionDate: submissionDate,
        updatedAt: new Date()
      })
      .where(eq(rewardPoints.userId, userId));

    // Check for achievements
    const achievements = await this.checkAndAwardAchievements(userId, submissionDate, newStreak);

    // Check for weekly completion bonus
    await this.checkWeeklyCompletion(userId, submissionDate);

    return {
      pointsEarned,
      newStreak,
      achievements,
      description
    };
  }

  // Calculate streak based on consecutive submissions
  private async calculateNewStreak(userId: string, currentSubmissionDate: string, lastSubmissionDate: string | null): Promise<number> {
    if (!lastSubmissionDate) return 1;

    const current = new Date(currentSubmissionDate);
    const last = new Date(lastSubmissionDate);
    
    // Check if any day between last submission and current has leave types
    const hasLeaveInBetween = await this.checkForLeaveTypesBetweenDates(userId, lastSubmissionDate, currentSubmissionDate);
    if (hasLeaveInBetween) {
      console.log(`🚫 Streak broken for ${userId} - leave type found between ${lastSubmissionDate} and ${currentSubmissionDate}`);
      return 1; // Reset streak due to leave type
    }
    
    // Check if it's consecutive days (considering weekends)
    const dayDifference = Math.floor((current.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    
    // If it's the next day (or next weekday), continue streak
    if (dayDifference === 1 || (dayDifference <= 3 && current.getDay() === 1 && last.getDay() === 5)) {
      const currentPoints = await this.getUserRewardPoints(userId);
      return (currentPoints?.currentStreak || 0) + 1;
    }
    
    // Otherwise, reset streak
    return 1;
  }

  // Add a reward transaction
  async addRewardTransaction(transaction: InsertRewardTransaction): Promise<RewardTransaction> {
    const [created] = await db.insert(rewardTransactions).values(transaction).returning();
    return created;
  }

  // Check and award achievements
  private async checkAndAwardAchievements(userId: string, submissionDate: string, currentStreak: number): Promise<RewardAchievement[]> {
    const newAchievements: RewardAchievement[] = [];

    // Get existing achievements to avoid duplicates
    const existingAchievements = await db
      .select()
      .from(rewardAchievements)
      .where(eq(rewardAchievements.userId, userId));
    
    const hasAchievement = (type: string) => 
      existingAchievements.some(a => a.achievementType === type);

    // Streak achievements
    if (currentStreak >= 5 && !hasAchievement('streak_5')) {
      newAchievements.push(await this.awardAchievement(userId, 'streak_5', REWARD_CONFIG.ACHIEVEMENTS.STREAK_5));
    }
    if (currentStreak >= 10 && !hasAchievement('streak_10')) {
      newAchievements.push(await this.awardAchievement(userId, 'streak_10', REWARD_CONFIG.ACHIEVEMENTS.STREAK_10));
    }
    if (currentStreak >= 20 && !hasAchievement('streak_20')) {
      newAchievements.push(await this.awardAchievement(userId, 'streak_20', REWARD_CONFIG.ACHIEVEMENTS.STREAK_20));
    }

    // Perfect week achievement
    const weekStats = await this.getWeekStats(userId, submissionDate);
    if (weekStats.weekdaysSubmitted === 5 && !hasAchievement(`perfect_week_${weekStats.weekKey}`)) {
      newAchievements.push(await this.awardAchievement(userId, `perfect_week_${weekStats.weekKey}`, REWARD_CONFIG.ACHIEVEMENTS.PERFECT_WEEK));
    }

    // Weekend warrior achievement (5 weekend submissions)
    const weekendCount = await this.getWeekendSubmissionCount(userId);
    if (weekendCount >= 5 && !hasAchievement('weekend_warrior')) {
      newAchievements.push(await this.awardAchievement(userId, 'weekend_warrior', REWARD_CONFIG.ACHIEVEMENTS.WEEKEND_WARRIOR));
    }

    return newAchievements;
  }

  // Award a specific achievement
  private async awardAchievement(userId: string, achievementType: string, achievementConfig: any): Promise<RewardAchievement> {
    const achievement: InsertRewardAchievement = {
      userId,
      achievementType,
      achievementName: achievementConfig.name,
      description: achievementConfig.description,
      pointsAwarded: achievementConfig.points,
      badgeIcon: achievementConfig.icon
    };

    const [created] = await db.insert(rewardAchievements).values(achievement).returning();

    // Award the points
    await this.addRewardTransaction({
      userId,
      type: "bonus",
      points: achievementConfig.points,
      reason: "achievement",
      description: `Achievement unlocked: ${achievementConfig.name}`,
      relatedDate: new Date().toISOString().split('T')[0],
      metadata: { achievementType, badge: achievementConfig.icon }
    });

    // Update user's available points
    const currentPoints = await this.getUserRewardPoints(userId);
    if (currentPoints) {
      await db
        .update(rewardPoints)
        .set({
          totalPoints: currentPoints.totalPoints + achievementConfig.points,
          availablePoints: currentPoints.availablePoints + achievementConfig.points,
          updatedAt: new Date()
        })
        .where(eq(rewardPoints.userId, userId));
    }

    return created;
  }

  // Get week statistics for a user
  private async getWeekStats(userId: string, submissionDate: string) {
    const date = new Date(submissionDate);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 }); // Sunday
    const weekKey = format(weekStart, 'yyyy-MM-dd');

    // Count weekday submissions this week
    const weekdaySubmissions = await db
      .select({ count: count() })
      .from(rewardTransactions)
      .where(
        and(
          eq(rewardTransactions.userId, userId),
          eq(rewardTransactions.reason, "daily_submission"),
          gte(rewardTransactions.relatedDate, format(weekStart, 'yyyy-MM-dd')),
          lte(rewardTransactions.relatedDate, format(weekEnd, 'yyyy-MM-dd'))
        )
      );

    return {
      weekKey,
      weekdaysSubmitted: weekdaySubmissions[0]?.count || 0
    };
  }

  // Get weekend submission count
  private async getWeekendSubmissionCount(userId: string): Promise<number> {
    const submissions = await db
      .select({ relatedDate: rewardTransactions.relatedDate })
      .from(rewardTransactions)
      .where(
        and(
          eq(rewardTransactions.userId, userId),
          eq(rewardTransactions.reason, "daily_submission")
        )
      );

    const weekendSubmissions = submissions.filter(s => {
      if (s.relatedDate) {
        const date = new Date(s.relatedDate);
        return isWeekend(date);
      }
      return false;
    });

    return weekendSubmissions.length;
  }

  // Check for weekly completion bonus
  private async checkWeeklyCompletion(userId: string, submissionDate: string) {
    // Check if this week has any leave types - if so, no weekly bonus
    const hasLeaveThisWeek = await this.checkForLeaveTypesInWeek(userId, submissionDate);
    if (hasLeaveThisWeek) {
      console.log(`🚫 No weekly bonus for ${userId} - leave type found in week of ${submissionDate}`);
      return;
    }
    
    const weekStats = await this.getWeekStats(userId, submissionDate);
    
    if (weekStats.weekdaysSubmitted === 5) {
      // Check if we've already awarded this week's bonus
      const existingWeeklyBonus = await db
        .select()
        .from(rewardTransactions)
        .where(
          and(
            eq(rewardTransactions.userId, userId),
            eq(rewardTransactions.reason, "weekly_bonus"),
            eq(rewardTransactions.relatedDate, weekStats.weekKey)
          )
        );

      if (existingWeeklyBonus.length === 0) {
        await this.addRewardTransaction({
          userId,
          type: "bonus",
          points: REWARD_CONFIG.WEEKLY_COMPLETION_BONUS,
          reason: "weekly_bonus",
          description: "Completed all weekday timesheets this week",
          relatedDate: weekStats.weekKey,
          metadata: { weekCompleted: true }
        });

        // Update user's available points
        const currentPoints = await this.getUserRewardPoints(userId);
        if (currentPoints) {
          await db
            .update(rewardPoints)
            .set({
              totalPoints: currentPoints.totalPoints + REWARD_CONFIG.WEEKLY_COMPLETION_BONUS,
              availablePoints: currentPoints.availablePoints + REWARD_CONFIG.WEEKLY_COMPLETION_BONUS,
              updatedAt: new Date()
            })
            .where(eq(rewardPoints.userId, userId));
        }
      }
    }
  }

  // Get leaderboard data
  async getLeaderboard(limit: number = 10): Promise<Array<{
    userId: string;
    firstName: string;
    lastName: string;
    totalPoints: number;
    currentStreak: number;
    longestStreak: number;
  }>> {
    const leaderboard = await db
      .select({
        userId: rewardPoints.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        totalPoints: rewardPoints.totalPoints,
        currentStreak: rewardPoints.currentStreak,
        longestStreak: rewardPoints.longestStreak
      })
      .from(rewardPoints)
      .leftJoin(users, eq(rewardPoints.userId, users.id))
      .orderBy(desc(rewardPoints.totalPoints))
      .limit(limit);

    return leaderboard.map(row => ({
      userId: row.userId,
      firstName: row.firstName || 'Unknown',
      lastName: row.lastName || 'User',
      totalPoints: row.totalPoints,
      currentStreak: row.currentStreak,
      longestStreak: row.longestStreak
    }));
  }

  // Get user's recent transactions
  async getUserTransactions(userId: string, limit: number = 20): Promise<RewardTransaction[]> {
    return await db
      .select()
      .from(rewardTransactions)
      .where(eq(rewardTransactions.userId, userId))
      .orderBy(desc(rewardTransactions.createdAt))
      .limit(limit);
  }

  // Get user's achievements
  async getUserAchievements(userId: string): Promise<RewardAchievement[]> {
    return await db
      .select()
      .from(rewardAchievements)
      .where(eq(rewardAchievements.userId, userId))
      .orderBy(desc(rewardAchievements.achievedAt));
  }

  // Get user dashboard data
  async getUserDashboard(userId: string) {
    const points = await this.getUserRewardPoints(userId);
    const recentTransactions = await this.getUserTransactions(userId, 5);
    const achievements = await this.getUserAchievements(userId);
    const leaderboard = await this.getLeaderboard(5);
    
    // Calculate user's rank
    const userRank = leaderboard.findIndex(u => u.userId === userId) + 1;

    return {
      points: points || {
        totalPoints: 0,
        availablePoints: 0,
        currentStreak: 0,
        longestStreak: 0
      },
      recentTransactions,
      achievements,
      leaderboard,
      userRank: userRank > 0 ? userRank : null,
      totalUsers: leaderboard.length
    };
  }

  // Check if a specific date has leave types for a user (excludes RDO from breaking streaks)
  private async checkForLeaveTypes(userId: string, date: string): Promise<boolean> {
    const { timesheetEntries } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    
    const entries = await db
      .select()
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.staffId, userId),
          eq(timesheetEntries.date, date),
          eq(timesheetEntries.submitted, true)
        )
      );

    // Check if any entry has leave types in the materials field (when jobId is null)
    // RDO is excluded from breaking streaks/bonuses per user request
    const leaveTypes = ['sick-leave', 'personal-leave', 'annual-leave'];
    return entries.some(entry => 
      !entry.jobId && entry.materials && leaveTypes.includes(entry.materials)
    );
  }

  // Check if there are leave types between two dates (excludes RDO from breaking streaks)
  private async checkForLeaveTypesBetweenDates(userId: string, startDate: string, endDate: string): Promise<boolean> {
    const { timesheetEntries } = await import("@shared/schema");
    const { eq, and, gte, lte } = await import("drizzle-orm");
    
    const entries = await db
      .select()
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.staffId, userId),
          gte(timesheetEntries.date, startDate),
          lte(timesheetEntries.date, endDate),
          eq(timesheetEntries.submitted, true)
        )
      );

    // Check if any entry has leave types in the materials field (when jobId is null)
    // RDO is excluded from breaking streaks/bonuses per user request
    const leaveTypes = ['sick-leave', 'personal-leave', 'annual-leave'];
    return entries.some(entry => 
      !entry.jobId && entry.materials && leaveTypes.includes(entry.materials)
    );
  }

  // Check if the week containing the given date has any leave types (excludes RDO from breaking weekly bonuses)
  private async checkForLeaveTypesInWeek(userId: string, submissionDate: string): Promise<boolean> {
    const { startOfWeek, endOfWeek, format } = await import("date-fns");
    const { timesheetEntries } = await import("@shared/schema");
    const { eq, and, gte, lte } = await import("drizzle-orm");
    
    const date = new Date(submissionDate);
    const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(date, { weekStartsOn: 1 }); // Sunday
    
    const entries = await db
      .select()
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.staffId, userId),
          gte(timesheetEntries.date, format(weekStart, 'yyyy-MM-dd')),
          lte(timesheetEntries.date, format(weekEnd, 'yyyy-MM-dd')),
          eq(timesheetEntries.submitted, true)
        )
      );

    // Check if any entry has leave types in the materials field (when jobId is null)
    // RDO is excluded from breaking streaks/bonuses per user request
    const leaveTypes = ['sick-leave', 'personal-leave', 'annual-leave'];
    return entries.some(entry => 
      !entry.jobId && entry.materials && leaveTypes.includes(entry.materials)
    );
  }

  // Check specifically for RDO days (separate from other leave types)
  private async checkForRDO(userId: string, date: string): Promise<boolean> {
    const { timesheetEntries } = await import("@shared/schema");
    const { eq, and } = await import("drizzle-orm");
    
    const entries = await db
      .select()
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.staffId, userId),
          eq(timesheetEntries.date, date),
          eq(timesheetEntries.submitted, true)
        )
      );

    // Check if any entry is an RDO
    return entries.some(entry => 
      !entry.jobId && entry.materials === 'rdo'
    );
  }
}

// Export singleton instance
export const rewardsService = new RewardsService();