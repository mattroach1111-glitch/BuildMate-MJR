import Navigation from "@/components/navigation";

interface PageLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}

export default function PageLayout({ children, title, subtitle, className = "" }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50 page-layout touch-pan-y" style={{ touchAction: 'pan-y' }}>
      <Navigation title={title} subtitle={subtitle} />
      <main className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 page-content touch-pan-y ${className}`} style={{ touchAction: 'pan-y' }}>
        {children}
      </main>
    </div>
  );
}