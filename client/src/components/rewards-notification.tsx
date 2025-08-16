import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Flame, Star, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RewardNotificationProps {
  pointsEarned?: number;
  newStreak?: number;
  achievements?: Array<{
    achievementName: string;
    badgeIcon: string;
    pointsAwarded: number;
  }>;
  description?: string;
  onClose?: () => void;
  show?: boolean;
}

const RewardNotification: React.FC<RewardNotificationProps> = ({
  pointsEarned = 0,
  newStreak = 0,
  achievements = [],
  description = '',
  onClose,
  show = false
}) => {
  const [isVisible, setIsVisible] = useState(show);

  useEffect(() => {
    setIsVisible(show);
  }, [show]);

  useEffect(() => {
    if (isVisible && pointsEarned > 0) {
      // Auto-hide after 8 seconds if no achievements to celebrate
      const timer = setTimeout(() => {
        if (achievements.length === 0) {
          handleClose();
        }
      }, 8000);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, pointsEarned, achievements.length]);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      onClose?.();
    }, 300);
  };

  if (!isVisible || pointsEarned === 0) return null;

  const getStreakColor = (streak: number) => {
    if (streak >= 20) return 'text-purple-600 bg-purple-100';
    if (streak >= 10) return 'text-red-600 bg-red-100';
    if (streak >= 5) return 'text-orange-600 bg-orange-100';
    return 'text-blue-600 bg-blue-100';
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -100, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -100, scale: 0.8 }}
          transition={{ type: "spring", duration: 0.6 }}
          className="fixed top-4 right-4 z-50 max-w-md"
          data-testid="reward-notification"
        >
          <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {/* Points Earned Section */}
                  <div className="flex items-center space-x-2 mb-3">
                    <Trophy className="h-5 w-5 text-yellow-600" />
                    <span className="font-semibold text-green-800">
                      +{pointsEarned} Points Earned!
                    </span>
                  </div>

                  {/* Description */}
                  {description && (
                    <p className="text-sm text-gray-700 mb-3">{description}</p>
                  )}

                  {/* Streak Information */}
                  {newStreak > 0 && (
                    <div className="flex items-center space-x-2 mb-3">
                      <Flame className="h-4 w-4 text-orange-600" />
                      <span className="text-sm">
                        <span className={`font-medium px-2 py-1 rounded-full text-xs ${getStreakColor(newStreak)}`}>
                          {newStreak} day streak!
                        </span>
                      </span>
                    </div>
                  )}

                  {/* Achievements */}
                  {achievements.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Star className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium text-purple-800">
                          New Achievement{achievements.length > 1 ? 's' : ''}!
                        </span>
                      </div>
                      {achievements.map((achievement, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + index * 0.2 }}
                          className="bg-white/60 rounded-lg p-2 border border-yellow-200"
                        >
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{achievement.badgeIcon}</span>
                            <div className="flex-1">
                              <div className="text-sm font-medium text-gray-800">
                                {achievement.achievementName}
                              </div>
                              <Badge variant="secondary" className="text-xs mt-1">
                                +{achievement.pointsAwarded} bonus points
                              </Badge>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700"
                  data-testid="button-close-notification"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Optional: Keep achievements visible longer */}
              {achievements.length > 0 && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClose}
                    className="w-full bg-white/50 hover:bg-white/70 text-green-800 border-green-300"
                    data-testid="button-celebrate-later"
                  >
                    Celebrate Later
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RewardNotification;