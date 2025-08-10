import { FortnightTimesheet } from "@/components/fortnight-timesheet";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";

export default function FortnightTimesheetView() {
  const { user } = useAuth();
  const [employeeId, setEmployeeId] = useState<string>("");
  const [isAdminView, setIsAdminView] = useState<boolean>(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const employee = urlParams.get('employee');
    const admin = urlParams.get('admin');
    
    if (employee) {
      setEmployeeId(employee);
    }
    
    if (admin === 'true') {
      setIsAdminView(true);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-6xl">
        <FortnightTimesheet 
          selectedEmployeeId={employeeId}
          isAdminView={isAdminView}
        />
      </div>
    </div>
  );
}