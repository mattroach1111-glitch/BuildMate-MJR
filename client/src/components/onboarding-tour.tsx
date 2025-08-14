import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, ChevronLeft, ChevronRight, Play, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string;
  position: "top" | "bottom" | "left" | "right";
  icon: React.ReactNode;
}

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

const adminTourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to BuildFlow Pro!",
    description: "Let's take a quick tour to get you started with managing your construction projects and workforce.",
    target: "",
    position: "top",
    icon: <Play className="h-5 w-5" />
  },
  {
    id: "jobs-tab",
    title: "Jobs Management",
    description: "Create, track, and manage all your construction jobs. Add project details, set hourly rates, and monitor progress.",
    target: '[data-testid="tab-jobs"]',
    position: "bottom",
    icon: <CheckCircle className="h-5 w-5" />
  },
  {
    id: "employees-tab",
    title: "Staff Management",
    description: "Add and manage your workforce. Set up employee profiles with default hourly rates and contact information.",
    target: '[data-testid="tab-employees"]',
    position: "bottom",
    icon: <CheckCircle className="h-5 w-5" />
  },
  {
    id: "timesheets-tab",
    title: "Timesheet Approvals",
    description: "Review and approve staff timesheet entries. Monitor labor costs and track project hours in real-time.",
    target: '[data-testid="tab-timesheets"]',
    position: "bottom",
    icon: <CheckCircle className="h-5 w-5" />
  },
  {
    id: "staff-view-tab",
    title: "Staff View Preview",
    description: "See exactly what your staff members see when they access their dashboard and submit timesheets.",
    target: '[data-testid="tab-staff-view"]',
    position: "bottom",
    icon: <CheckCircle className="h-5 w-5" />
  },
  {
    id: "settings-tab",
    title: "Settings & Integrations",
    description: "Configure Google Drive integration to automatically save timesheet PDFs and manage application preferences.",
    target: '[data-testid="tab-settings"]',
    position: "bottom",
    icon: <CheckCircle className="h-5 w-5" />
  },
  {
    id: "create-job",
    title: "Create Your First Job",
    description: "Click here to create your first construction project. Add the job address, client details, and project manager.",
    target: '[data-testid="button-create-job"]',
    position: "left",
    icon: <CheckCircle className="h-5 w-5" />
  },
  {
    id: "complete",
    title: "You're All Set!",
    description: "You've completed the tour. Start by creating jobs, adding staff, and let your team submit timesheets. Need help? Check the documentation or contact support.",
    target: "",
    position: "top",
    icon: <CheckCircle className="h-5 w-5" />
  }
];

const staffTourSteps: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to BuildFlow Pro!",
    description: "Let's show you how to submit timesheets and track your work hours efficiently.",
    target: "",
    position: "top",
    icon: <Play className="h-5 w-5" />
  },
  {
    id: "timesheet-view",
    title: "Your Timesheet",
    description: "This is your fortnight timesheet view. Add your daily hours, select jobs, and submit for approval.",
    target: '[data-testid="container-timesheet"]',
    position: "top",
    icon: <CheckCircle className="h-5 w-5" />
  },
  {
    id: "add-hours",
    title: "Adding Hours",
    description: "Click on any day to add your work hours. You can work on multiple jobs per day and track different activities.",
    target: '[data-testid="button-add-hours"]',
    position: "left",
    icon: <CheckCircle className="h-5 w-5" />
  },
  {
    id: "submit-timesheet",
    title: "Submit for Approval",
    description: "Once you've entered all your hours, submit your timesheet for admin approval. You'll receive confirmation when processed.",
    target: '[data-testid="button-submit-timesheet"]',
    position: "top",
    icon: <CheckCircle className="h-5 w-5" />
  },
  {
    id: "complete",
    title: "Ready to Track Time!",
    description: "You're ready to start tracking your work hours. Remember to submit your timesheets regularly for timely processing.",
    target: "",
    position: "top",
    icon: <CheckCircle className="h-5 w-5" />
  }
];

export function OnboardingTour({ isOpen, onClose, onComplete }: OnboardingTourProps) {
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  
  const isAdmin = (user as any)?.role === "admin";
  const tourSteps = isAdmin ? adminTourSteps : staffTourSteps;

  const currentStepData = tourSteps[currentStep];

  useEffect(() => {
    if (isOpen && currentStepData?.target) {
      const element = document.querySelector(currentStepData.target);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        // Add highlight effect
        element.classList.add("ring-2", "ring-primary", "ring-offset-2");
        setTimeout(() => {
          element.classList.remove("ring-2", "ring-primary", "ring-offset-2");
        }, 2000);
      }
    }
  }, [currentStep, isOpen, currentStepData]);

  const nextStep = () => {
    if (currentStep < tourSteps.length - 1) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(currentStep + 1);
        setIsAnimating(false);
      }, 150);
    } else {
      onComplete();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(currentStep - 1);
        setIsAnimating(false);
      }, 150);
    }
  };

  const skipTour = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        data-testid="onboarding-overlay"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ 
            scale: isAnimating ? 0.95 : 1, 
            opacity: isAnimating ? 0.8 : 1 
          }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative max-w-md w-full"
        >
          <Card className="border-2 border-primary/20 shadow-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    className="p-2 bg-primary/10 rounded-full text-primary"
                  >
                    {currentStepData.icon}
                  </motion.div>
                  <div>
                    <CardTitle className="text-lg">{currentStepData.title}</CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">
                        Step {currentStep + 1} of {tourSteps.length}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {isAdmin ? "Admin Tour" : "Staff Tour"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipTour}
                  className="h-8 w-8 p-0"
                  data-testid="button-close-tour"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <motion.p
                key={currentStep}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-muted-foreground leading-relaxed"
              >
                {currentStepData.description}
              </motion.p>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{Math.round(((currentStep + 1) / tourSteps.length) * 100)}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <motion.div
                    className="bg-primary rounded-full h-2"
                    initial={{ width: 0 }}
                    animate={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="flex items-center gap-2"
                  data-testid="button-prev-step"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    onClick={skipTour}
                    className="text-muted-foreground"
                    data-testid="button-skip-tour"
                  >
                    Skip Tour
                  </Button>
                  <Button
                    onClick={nextStep}
                    className="flex items-center gap-2"
                    data-testid="button-next-step"
                  >
                    {currentStep === tourSteps.length - 1 ? (
                      <>
                        Complete
                        <CheckCircle className="h-4 w-4" />
                      </>
                    ) : (
                      <>
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Welcome animation component for first-time users
export function WelcomeAnimation({ onComplete }: { onComplete: () => void }) {
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="fixed inset-0 bg-gradient-to-br from-primary/20 to-blue-600/20 z-50 flex items-center justify-center p-4"
      data-testid="welcome-animation"
    >
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="text-center max-w-md"
      >
        <motion.div
          animate={{ 
            scale: [1, 1.1, 1],
            rotate: [0, 5, -5, 0]
          }}
          transition={{ 
            duration: 2, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className="mb-6"
        >
          <div className="w-24 h-24 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="text-primary text-4xl font-bold"
            >
              B
            </motion.div>
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-3xl font-bold text-foreground mb-4"
        >
          Welcome to BuildFlow Pro
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-muted-foreground mb-8 leading-relaxed"
        >
          {isAdmin 
            ? "Your complete construction management solution. Streamline job costing, workforce management, and project oversight."
            : "Track your work hours efficiently and submit timesheets with ease. Let's get you started!"
          }
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <Button
            onClick={onComplete}
            size="lg"
            className="px-8 py-3 text-lg font-medium"
            data-testid="button-start-tour"
          >
            Start Interactive Tour
            <ChevronRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="mt-6 text-xs text-muted-foreground"
        >
          This will only take 2 minutes
        </motion.div>
      </motion.div>
    </motion.div>
  );
}