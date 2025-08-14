import { useState, useEffect } from "react";
// useAuth removed - useOnboarding now works independently

const ONBOARDING_STORAGE_KEY = "buildflow_onboarding_completed";
const WELCOME_STORAGE_KEY = "buildflow_welcome_shown";

export function useOnboarding() {
  // User context removed - onboarding now works independently
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  useEffect(() => {
    // Simplified onboarding - using general key for all users
    const userId = "general";
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
  }, []);

  const startTour = () => {
    setShowWelcome(false);
    setShowTour(true);
    
    const userId = "general";
    const welcomeKey = `${WELCOME_STORAGE_KEY}_${userId}`;
    localStorage.setItem(welcomeKey, "true");
  };

  const completeTour = () => {
    setShowTour(false);
    setIsOnboardingComplete(true);
    
    const userId = "general";
    const onboardingKey = `${ONBOARDING_STORAGE_KEY}_${userId}`;
    localStorage.setItem(onboardingKey, "true");
  };

  const skipTour = () => {
    setShowWelcome(false);
    setShowTour(false);
    
    const userId = "general";
    const onboardingKey = `${ONBOARDING_STORAGE_KEY}_${userId}`;
    const welcomeKey = `${WELCOME_STORAGE_KEY}_${userId}`;
    localStorage.setItem(onboardingKey, "true");
    localStorage.setItem(welcomeKey, "true");
    setIsOnboardingComplete(true);
  };

  const resetOnboarding = () => {
    const userId = "general";
    const onboardingKey = `${ONBOARDING_STORAGE_KEY}_${userId}`;
    const welcomeKey = `${WELCOME_STORAGE_KEY}_${userId}`;
    localStorage.removeItem(onboardingKey);
    localStorage.removeItem(welcomeKey);
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