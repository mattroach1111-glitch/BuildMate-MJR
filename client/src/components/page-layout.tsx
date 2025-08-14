import Navigation from "@/components/navigation";
import { NotificationPermissionBanner } from "./NotificationPermissionBanner";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

export default function PageLayout({ children, title, subtitle, className = "" }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation title={title} subtitle={subtitle} />
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 ${className}`}>
        <NotificationPermissionBanner />
        {children}
      </main>
    </div>
  );
}