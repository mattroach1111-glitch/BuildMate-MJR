import { FortnightTimesheet } from "@/components/fortnight-timesheet";
import { useAuth } from "@/hooks/useAuth";

export default function FortnightTimesheetView() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-6xl">
        <FortnightTimesheet />
      </div>
    </div>
  );
}