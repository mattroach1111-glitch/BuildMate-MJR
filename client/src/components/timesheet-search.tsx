import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Calendar, User, FileText, Download, Filter, X } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface TimesheetSearchResult {
  id: string;
  staffId: string;
  employeeName: string;
  date: string;
  hours: string;
  jobId: string;
  jobAddress: string;
  jobClient: string;
  materials: string;
  approved: boolean;
  createdAt: string;
}

interface SearchFilters {
  employeeName: string;
  jobAddress: string;
  client: string;
  dateFrom: string;
  dateTo: string;
  approvalStatus: string;
  minHours: string;
  maxHours: string;
}

export function TimesheetSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    employeeName: '',
    jobAddress: '',
    client: '',
    dateFrom: '',
    dateTo: '',
    approvalStatus: '',
    minHours: '',
    maxHours: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const { data: searchResults, isLoading, refetch } = useQuery({
    queryKey: ['/api/timesheet-search', searchQuery, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      
      const response = await fetch(`/api/timesheet-search?${params.toString()}`);
      if (!response.ok) throw new Error('Search failed');
      return response.json();
    },
    enabled: false // Only run when explicitly triggered
  });

  const handleSearch = () => {
    refetch();
  };

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      employeeName: '',
      jobAddress: '',
      client: '',
      dateFrom: '',
      dateTo: '',
      approvalStatus: '',
      minHours: '',
      maxHours: ''
    });
    setSearchQuery('');
  };

  const setQuickDateRange = (range: 'thisMonth' | 'lastMonth' | 'last3Months') => {
    const now = new Date();
    let dateFrom: Date;
    let dateTo: Date;

    switch (range) {
      case 'thisMonth':
        dateFrom = startOfMonth(now);
        dateTo = endOfMonth(now);
        break;
      case 'lastMonth':
        dateFrom = startOfMonth(subMonths(now, 1));
        dateTo = endOfMonth(subMonths(now, 1));
        break;
      case 'last3Months':
        dateFrom = startOfMonth(subMonths(now, 3));
        dateTo = endOfMonth(now);
        break;
    }

    handleFilterChange('dateFrom', format(dateFrom, 'yyyy-MM-dd'));
    handleFilterChange('dateTo', format(dateTo, 'yyyy-MM-dd'));
  };

  const getTotalHours = () => {
    if (!searchResults?.results) return 0;
    return searchResults.results.reduce((sum: number, entry: TimesheetSearchResult) => 
      sum + parseFloat(entry.hours || '0'), 0);
  };

  const exportResults = () => {
    if (!searchResults?.results) return;

    const csvContent = [
      ['Employee', 'Date', 'Hours', 'Job Address', 'Client', 'Materials', 'Status'].join(','),
      ...searchResults.results.map((entry: TimesheetSearchResult) => [
        entry.employeeName,
        format(parseISO(entry.date), 'yyyy-MM-dd'),
        entry.hours,
        entry.jobAddress || 'N/A',
        entry.jobClient || 'N/A',
        entry.materials || '',
        entry.approved ? 'Approved' : 'Pending'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timesheet-search-results-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Timesheet Search
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                data-testid="button-toggle-advanced-filters"
              >
                <Filter className="h-4 w-4 mr-2" />
                {showAdvancedFilters ? 'Hide' : 'Show'} Filters
              </Button>
              {(searchQuery || Object.values(filters).some(v => v)) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                  data-testid="button-clear-filters"
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Main Search */}
          <div className="flex gap-2">
            <Input
              placeholder="Search by employee name, job address, or materials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              className="flex-1"
              data-testid="input-search-query"
            />
            <Button onClick={handleSearch} disabled={isLoading} data-testid="button-search">
              <Search className="h-4 w-4 mr-2" />
              {isLoading ? 'Searching...' : 'Search'}
            </Button>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="text-sm font-medium mb-1 block">Employee</label>
                <Input
                  placeholder="Employee name"
                  value={filters.employeeName}
                  onChange={(e) => handleFilterChange('employeeName', e.target.value)}
                  data-testid="input-filter-employee"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Job Address</label>
                <Input
                  placeholder="Job address"
                  value={filters.jobAddress}
                  onChange={(e) => handleFilterChange('jobAddress', e.target.value)}
                  data-testid="input-filter-job"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Client</label>
                <Input
                  placeholder="Client name"
                  value={filters.client}
                  onChange={(e) => handleFilterChange('client', e.target.value)}
                  data-testid="input-filter-client"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Status</label>
                <Select value={filters.approvalStatus} onValueChange={(value) => handleFilterChange('approvalStatus', value)}>
                  <SelectTrigger data-testid="select-filter-status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All statuses</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Date From</label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                  data-testid="input-filter-date-from"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Date To</label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                  data-testid="input-filter-date-to"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Min Hours</label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="0"
                  value={filters.minHours}
                  onChange={(e) => handleFilterChange('minHours', e.target.value)}
                  data-testid="input-filter-min-hours"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Max Hours</label>
                <Input
                  type="number"
                  step="0.5"
                  placeholder="24"
                  value={filters.maxHours}
                  onChange={(e) => handleFilterChange('maxHours', e.target.value)}
                  data-testid="input-filter-max-hours"
                />
              </div>

              {/* Quick Date Filters */}
              <div className="md:col-span-2 lg:col-span-4">
                <label className="text-sm font-medium mb-2 block">Quick Date Ranges</label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickDateRange('thisMonth')}
                    data-testid="button-this-month"
                  >
                    This Month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickDateRange('lastMonth')}
                    data-testid="button-last-month"
                  >
                    Last Month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setQuickDateRange('last3Months')}
                    data-testid="button-last-3-months"
                  >
                    Last 3 Months
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Search Results */}
      {searchResults && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Search Results
                </CardTitle>
                <Badge variant="secondary">
                  {searchResults.results?.length || 0} entries
                </Badge>
                <Badge variant="outline">
                  {getTotalHours()}h total
                </Badge>
              </div>
              {searchResults.results?.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportResults}
                  data-testid="button-export-results"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {searchResults.results?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No timesheet entries found matching your search criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Employee</th>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Hours</th>
                      <th className="text-left p-3 font-medium">Job</th>
                      <th className="text-left p-3 font-medium">Client</th>
                      <th className="text-left p-3 font-medium">Materials</th>
                      <th className="text-left p-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.results?.map((entry: TimesheetSearchResult) => (
                      <tr key={entry.id} className="border-b hover:bg-gray-50">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span className="font-medium">{entry.employeeName}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-gray-400" />
                            {format(parseISO(entry.date), 'MMM dd, yyyy')}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="font-mono">
                            {entry.hours}h
                          </Badge>
                        </td>
                        <td className="p-3 max-w-48">
                          <div className="truncate" title={entry.jobAddress}>
                            {entry.jobAddress || 'N/A'}
                          </div>
                        </td>
                        <td className="p-3 max-w-32">
                          <div className="truncate" title={entry.jobClient}>
                            {entry.jobClient || 'N/A'}
                          </div>
                        </td>
                        <td className="p-3 max-w-48">
                          <div className="truncate" title={entry.materials}>
                            {entry.materials || '-'}
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge 
                            variant={entry.approved ? "default" : "secondary"}
                            className={entry.approved ? "bg-green-600" : ""}
                          >
                            {entry.approved ? 'Approved' : 'Pending'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}