import { useState, useEffect } from "react";
import { useAuth } from "./useAuth";

const ONBOARDING_STORAGE_KEY = "buildflow_onboarding_completed";
const WELCOME_STORAGE_KEY = "buildflow_welcome_shown";

export function useOnboarding() {
  const { user, isAuthenticated } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  useEffect(() => {
    if (isAuthenticated && user) {
      const userId = (user as any).id;
      const onboardingKey = `${ONBOARDING_STORAGE_KEY}_${userId}`;
      const welcomeKey = `${WELCOME_STORAGE_KEY}_${userId}`;
      
      const onboardingComplete = localStorage.getItem(onboardingKey) === "true";
      const welcomeShown = localStorage.getItem(welcomeKey) === "true";
      
      setIsOnboardingComplete(onboardingComplete);
      
      // Show welcome animation for new users
      if (!welcomeShown && !onboardingComplete) {
        setTimeout(() => {
          setShowWelcome(true);
        }, 1000); // Delay to let the dashboard load
      }
    }
  }, [isAuthenticated, user]);

  const startTour = () => {
    setShowWelcome(false);
    setShowTour(true);
    
    if (user) {
      const userId = (user as any).id;
      const welcomeKey = `${WELCOME_STORAGE_KEY}_${userId}`;
      localStorage.setItem(welcomeKey, "true");
    }
  };

  const completeTour = () => {
    setShowTour(false);
    setIsOnboardingComplete(true);
    
    if (user) {
      const userId = (user as any).id;
      const onboardingKey = `${ONBOARDING_STORAGE_KEY}_${userId}`;
      localStorage.setItem(onboardingKey, "true");
    }
  };

  const skipTour = () => {
    setShowWelcome(false);
    setShowTour(false);
    
    if (user) {
      const userId = (user as any).id;
      const onboardingKey = `${ONBOARDING_STORAGE_KEY}_${userId}`;
      const welcomeKey = `${WELCOME_STORAGE_KEY}_${userId}`;
      localStorage.setItem(onboardingKey, "true");
      localStorage.setItem(welcomeKey, "true");
    }
    setIsOnboardingComplete(true);
  };

  const resetOnboarding = () => {
    if (user) {
      const userId = (user as any).id;
      const onboardingKey = `${ONBOARDING_STORAGE_KEY}_${userId}`;
      const welcomeKey = `${WELCOME_STORAGE_KEY}_${userId}`;
      localStorage.removeItem(onboardingKey);
      localStorage.removeItem(welcomeKey);
    }
    setIsOnboardingComplete(false);
    setShowWelcome(true);
  };

  return {
    showWelcome,
    showTour,
    isOnboardingComplete,
    startTour,
    completeTour,
    skipTour,
    resetOnboarding
  };
}