import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Job {
  id: string;
  jobAddress: string;
  clientName: string;
  projectName: string;
}

interface JobAddressSearchProps {
  value: string;
  onValueChange: (jobId: string) => void;
  jobs: Job[];
  placeholder?: string;
  className?: string;
}

export function JobAddressSearch({ 
  value, 
  onValueChange, 
  jobs, 
  placeholder = "Search job address...",
  className 
}: JobAddressSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [filteredJobs, setFilteredJobs] = useState<Job[]>(jobs);

  // Find the selected job to display
  const selectedJob = jobs.find(job => job.id === value);

  // Filter jobs based on search text and sort alphabetically
  useEffect(() => {
    let filtered = jobs;
    
    if (searchText.trim()) {
      filtered = jobs.filter(job =>
        job.jobAddress.toLowerCase().includes(searchText.toLowerCase()) ||
        job.clientName.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    // Sort alphabetically by job address
    filtered = filtered.sort((a, b) => a.jobAddress.localeCompare(b.jobAddress));
    
    setFilteredJobs(filtered);
  }, [searchText, jobs]);

  const handleJobSelect = (job: Job) => {
    onValueChange(job.id);
    setIsOpen(false);
    setSearchText("");
  };

  const displayText = selectedJob 
    ? `${selectedJob.jobAddress} - ${selectedJob.clientName}`
    : placeholder;

  return (
    <div className={cn("relative", className)}>
      {/* Trigger Button */}
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between text-left font-normal"
        data-testid="job-address-search-trigger"
      >
        <span className={cn(
          "truncate",
          !selectedJob && "text-muted-foreground"
        )}>
          {displayText}
        </span>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
          {/* Search Input */}
          <div className="p-2 border-b">
            <Input
              placeholder="Type to search addresses..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="h-8"
              data-testid="job-address-search-input"
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="max-h-60 overflow-y-auto">
            {filteredJobs.length > 0 ? (
              filteredJobs.map((job) => (
                <button
                  key={job.id}
                  className="w-full text-left px-3 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0"
                  onClick={() => handleJobSelect(job)}
                  data-testid={`job-option-${job.id}`}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{job.jobAddress}</div>
                      <div className="text-sm text-gray-500 truncate">{job.clientName}</div>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No jobs found matching "{searchText}"
              </div>
            )}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}