import { FortnightTimesheet } from "@/components/fortnight-timesheet";
import PageLayout from "@/components/page-layout";

export default function StaffTimesheet() {
  return (
    <PageLayout title="Fortnight Timesheet">
      <div className="max-w-6xl mx-auto">
        <FortnightTimesheet 
          selectedEmployeeId=""
          isAdminView={false}
        />
      </div>
    </PageLayout>
  );
}