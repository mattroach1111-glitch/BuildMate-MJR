import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Search, 
  MapPin, 
  User, 
  Calendar, 
  DollarSign, 
  Eye,
  Filter,
  Building2,
  Clock,
  ArrowLeft
} from "lucide-react";

interface Job {
  id: string;
  jobAddress: string;
  clientName: string;
  projectManager?: string;
  status: string;
  createdAt: string;
  totalAmount: number;
  laborCost: number;
  materialsCost: number;
  subtradesCost: number;
  otherCosts: number;
  tipFees: number;
  gstAmount: number;
}

export function JobsList() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [projectManagerFilter, setProjectManagerFilter] = useState("all");

  // Fetch jobs data
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["/api/jobs"],
  });

  // Type the jobs data properly with safety check
  const typedJobs = (Array.isArray(jobs) ? jobs : []) as Job[];

  // Filter and search jobs
  const filteredJobs = typedJobs.filter((job: Job) => {
    const matchesSearch = 
      job.jobAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.projectManager?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false);
    
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    const matchesProjectManager = projectManagerFilter === "all" || job.projectManager === projectManagerFilter;
    
    return matchesSearch && matchesStatus && matchesProjectManager;
  });

  // Get unique values for filters with safety checks
  const uniqueStatuses = Array.from(new Set(typedJobs.map((job: Job) => job.status).filter(Boolean)));
  const uniqueProjectManagers = Array.from(new Set(typedJobs.map((job: Job) => job.projectManager).filter(Boolean)));

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'new_job': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'job_in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'job_on_hold': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'job_complete': return 'bg-green-100 text-green-800 border-green-200';
      case 'ready_for_billing': return 'bg-purple-100 text-purple-800 border-purple-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading jobs...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => setLocation("/admin")}
            className="flex items-center gap-2"
            data-testid="button-back-to-dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">All Jobs</h1>
            <p className="text-gray-600">{filteredJobs.length} jobs found</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters & Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search address, client, or PM..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-jobs"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger data-testid="select-status-filter">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {uniqueStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Project Manager</label>
              <Select value={projectManagerFilter} onValueChange={setProjectManagerFilter}>
                <SelectTrigger data-testid="select-pm-filter">
                  <SelectValue placeholder="All project managers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Project Managers</SelectItem>
                  {uniqueProjectManagers.map((pm) => (
                    <SelectItem key={pm} value={pm || ""}>
                      {pm}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("all");
                  setProjectManagerFilter("all");
                }}
                className="w-full"
                data-testid="button-clear-filters"
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Jobs List */}
      <div className="grid gap-4">
        {filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No jobs found</h3>
              <p className="text-gray-600">Try adjusting your search or filter criteria</p>
            </CardContent>
          </Card>
        ) : (
          filteredJobs.map((job: Job) => (
            <Card key={job.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-start">
                  {/* Job Info */}
                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-gray-900">{job.jobAddress}</h3>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {job.clientName}
                        </p>
                      </div>
                    </div>
                    
                    {job.projectManager && (
                      <p className="text-sm text-gray-600 flex items-center gap-1 ml-6">
                        <Building2 className="h-3 w-3" />
                        PM: {job.projectManager}
                      </p>
                    )}
                  </div>

                  {/* Status & Date */}
                  <div className="space-y-2">
                    <Badge className={getStatusColor(job.status)}>
                      {job.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </Badge>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatDate(job.createdAt)}
                    </p>
                  </div>

                  {/* Job Details */}
                  <div className="md:col-span-2 space-y-1">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-gray-600">Status:</div>
                      <div className="font-medium">{job.status.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</div>
                      <div className="text-gray-600">Created:</div>
                      <div className="font-medium">{formatDate(job.createdAt)}</div>
                      {job.projectManager && (
                        <>
                          <div className="text-gray-600">PM:</div>
                          <div className="font-medium">{job.projectManager}</div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col items-end gap-3">
                    
                    <Button
                      onClick={() => setLocation(`/admin?jobId=${job.id}`)}
                      size="sm"
                      className="flex items-center gap-1"
                      data-testid={`button-view-job-${job.id}`}
                    >
                      <Eye className="h-3 w-3" />
                      View Details
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Summary */}
      {filteredJobs.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-blue-600">{filteredJobs.length}</p>
                <p className="text-sm text-gray-600">Total Jobs</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {filteredJobs.filter((job: Job) => job.status === 'new_job').length}
                </p>
                <p className="text-sm text-gray-600">New Jobs</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-purple-600">
                  {filteredJobs.filter((job: Job) => job.status === 'job_complete').length}
                </p>
                <p className="text-sm text-gray-600">Completed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {filteredJobs.filter((job: Job) => job.status === 'job_in_progress').length}
                </p>
                <p className="text-sm text-gray-600">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}