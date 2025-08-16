# BuildFlow Pro Rewards System

## Overview
The BuildFlow Pro Rewards System incentivizes timely timesheet submissions through a comprehensive points-based rewards program. Staff earn points for consistent submissions, build streaks, unlock achievements, and compete on leaderboards.

## Important: Leave Type Exclusions
**Leave days DO NOT earn points and BREAK streaks and weekly bonuses:**
- Sick Leave
- Personal Leave
- Annual Leave
- RDO (Rostered Day Off)

If any day in your week contains a leave type, you will not receive weekly completion bonuses, even if you submit all other weekdays. Leave types also immediately break streak counters.

## How Points Are Calculated

### Base Points
- **Daily Submission**: 10 points for each day a timesheet is submitted
- **Weekly Bonus**: 50 points for completing all 5 weekdays in a work week
- **Perfect Week**: 100 bonus points for submitting every day including weekends
- **Monthly Bonus**: 200 points for consistent submissions throughout the month
- **Perfect Month**: 500 bonus points for perfect attendance all month

### Streak Multipliers
- **Streak Bonus**: 1.5x multiplier applied to daily points when on a streak
- **Example**: Day 1 = 10 points, Day 2 = 15 points (10 × 1.5), Day 3 = 15 points, etc.

### Achievement System
Special one-time achievements unlock bonus points:
- **First Timer**: 25 points for first submission
- **Week Warrior**: 75 points for first perfect week
- **Streak Master**: 150 points for reaching 10-day streak
- **Month Champion**: 300 points for first perfect month
- **Consistency King**: 500 points for 30-day streak

## Admin Management Features

### Point Configuration
Admins can adjust all point values through the **Rewards Config** page:
- Modify daily submission points
- Adjust weekly and monthly bonuses
- Change streak multipliers
- Set achievement point values

### Prize Catalog Management
Admins can create and manage a redemption catalog:
- **Add Prizes**: Gift cards, time off, merchandise, experiences
- **Set Point Costs**: Configure how many points each prize requires
- **Manage Stock**: Track quantity for limited prizes
- **Categories**: Organize prizes by type for easy browsing

### Analytics Dashboard
Track system performance and engagement:
- **Total Points Awarded**: Overall system activity
- **Total Redemptions**: Prize popularity and usage
- **Active Users**: Staff participation rates
- **Top Performers**: Leaderboard with current leaders

## Staff Experience

### Earning Points
1. **Submit Timesheets**: Use the "Confirm Timesheet" button to earn points
2. **Build Streaks**: Submit consistently to activate multipliers
3. **Unlock Achievements**: Reach milestones for bonus rewards
4. **View Progress**: Track points, streaks, and achievements on rewards dashboard

### Rewards Dashboard
Staff can access their personal dashboard via the "Rewards" navigation link:
- **Current Points Balance**: Total and available points
- **Streak Tracking**: Current and longest streak counts
- **Achievement Gallery**: Unlocked badges and progress
- **Leaderboard**: Compare performance with colleagues
- **Point History**: Detailed transaction log

### Notification System
Immediate feedback when earning rewards:
- **Points Earned**: Shows points gained after submission
- **New Achievements**: Celebrates unlocked badges
- **Streak Updates**: Displays current streak progress
- **Bonus Notifications**: Highlights special bonuses earned

## Technical Implementation

### Database Schema
```sql
-- Core rewards tracking
reward_points: user_id, total_points, available_points, current_streak, longest_streak

-- Transaction history
reward_transactions: user_id, type, points, reason, description, created_at

-- Achievement tracking  
reward_achievements: user_id, achievement_type, achievement_name, points_awarded

-- Prize catalog (future)
reward_catalog: title, description, points_cost, category, stock_quantity

-- Redemption tracking (future)
reward_redemptions: user_id, prize_id, points_spent, redeemed_at
```

### API Endpoints
- `GET /api/rewards/dashboard` - User's personal rewards data
- `GET /api/rewards/leaderboard` - Staff rankings
- `GET /api/admin/rewards/dashboard` - Admin analytics
- `PUT /api/admin/rewards/settings` - Update point configuration
- `POST /api/admin/rewards/prizes` - Add new prizes
- `DELETE /api/admin/rewards/prizes/:id` - Remove prizes

### Integration Points
The rewards system automatically processes when:
- Staff submit timesheets via "Confirm Timesheet"
- System calculates streaks based on submission dates
- Achievements are evaluated against user history
- Points are awarded and notifications displayed

## Future Enhancements

### Prize Redemption
- Staff can spend points on actual prizes
- Automated approval workflow for redemptions
- Email notifications for prize fulfillment
- Inventory management for physical items

### Advanced Analytics
- Engagement trends over time
- Department-wise performance comparisons
- Seasonal submission patterns
- ROI analysis on rewards investment

### Gamification Features
- Team challenges and competitions
- Seasonal events with bonus multipliers
- Badge collections and rare achievements
- Social features like sharing achievements

## Getting Started

### For Admins
1. Visit **Rewards Config** in the admin navigation
2. Review and adjust point values in **Point Settings**
3. Add prizes in the **Prize Catalog** section
4. Monitor engagement in the **Analytics** tab

### For Staff
1. Continue submitting timesheets as normal
2. Watch for reward notifications after submission
3. Visit the **Rewards** dashboard to track progress
4. Build streaks for bonus multipliers

The rewards system is designed to be transparent, engaging, and easily configurable to match your organization's culture and goals.