import { useState, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Package, Wrench, DollarSign, FileText, Clock, ArrowLeft, X } from "lucide-react";
import { useLocation } from "wouter";

interface SearchMatch {
  type: "material" | "sub-trade" | "other-cost" | "tip-fee" | "timesheet-note";
  text: string;
  extra: string | null;
  amount: string | null;
  date: string | null;
  itemId: string;
}

interface JobResult {
  jobId: string;
  jobAddress: string;
  clientName: string;
  status: string;
  isArchived: boolean;
  matches: SearchMatch[];
}

interface SearchResponse {
  results: JobResult[];
  total: number;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  material: {
    label: "Material",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Package className="h-3 w-3" />,
  },
  "sub-trade": {
    label: "Sub-trade",
    color: "bg-purple-100 text-purple-800 border-purple-200",
    icon: <Wrench className="h-3 w-3" />,
  },
  "other-cost": {
    label: "Other Cost",
    color: "bg-orange-100 text-orange-800 border-orange-200",
    icon: <DollarSign className="h-3 w-3" />,
  },
  "tip-fee": {
    label: "Tip Fee",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <FileText className="h-3 w-3" />,
  },
  "timesheet-note": {
    label: "Timesheet Note",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: <Clock className="h-3 w-3" />,
  },
};

function highlightMatch(text: string, query: string) {
  if (!query || !text) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-yellow-200 rounded px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export default function ItemSearchPage() {
  const [, setLocation] = useLocation();
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data, isLoading } = useQuery<SearchResponse>({
    queryKey: ["/api/search/items", searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return { results: [], total: 0 };
      const res = await fetch(`/api/search/items?q=${encodeURIComponent(searchQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: searchQuery.length >= 2,
  });

  const handleInput = useCallback((val: string) => {
    setInputValue(val);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setSearchQuery(val.trim());
    }, 400);
  }, []);

  const clearSearch = () => {
    setInputValue("");
    setSearchQuery("");
  };

  const results = data?.results ?? [];
  const hasResults = results.length > 0;
  const searched = searchQuery.length >= 2;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search items, materials, sub-trades, notes…"
              value={inputValue}
              onChange={(e) => handleInput(e.target.value)}
              className="pl-9 pr-9 h-11 text-base"
            />
            {inputValue && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {/* Status bar */}
        {searched && !isLoading && (
          <p className="text-sm text-muted-foreground">
            {hasResults
              ? `Found "${searchQuery}" across ${results.length} job${results.length !== 1 ? "s" : ""}`
              : `No results for "${searchQuery}"`}
          </p>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Searching all job sheets…
          </div>
        )}

        {/* Empty state */}
        {!searched && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">Search across all job sheets</p>
            <p className="text-sm mt-1">
              Find where any material, tool, sub-trade, or item was used
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["coil nails", "compressor", "underlay", "plumber", "tip fee"].map((term) => (
                <button
                  key={term}
                  onClick={() => { setInputValue(term); handleInput(term); }}
                  className="px-3 py-1.5 rounded-full bg-white border text-sm hover:bg-gray-50 transition-colors"
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {searched && !isLoading && !hasResults && (
          <div className="text-center py-16 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">Nothing found for "{searchQuery}"</p>
            <p className="text-sm mt-1">Try a shorter or different search term</p>
          </div>
        )}

        {/* Results */}
        {results.map((job) => (
          <Card key={job.jobId} className="shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <CardTitle className="text-base leading-tight">
                      {job.jobAddress}
                    </CardTitle>
                    {job.clientName && (
                      <p className="text-xs text-muted-foreground mt-0.5">{job.clientName}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {job.isArchived && (
                    <Badge className="text-xs bg-gray-200 text-gray-700 border-gray-300 whitespace-nowrap">
                      Archived
                    </Badge>
                  )}
                  {!job.isArchived && (
                    <Badge variant="outline" className="text-xs capitalize whitespace-nowrap">
                      {job.status}
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => setLocation(`/?job=${job.jobId}`)}
                  >
                    Open Job
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {job.matches.map((match, idx) => {
                const cfg = TYPE_CONFIG[match.type] || TYPE_CONFIG["other-cost"];
                return (
                  <div
                    key={`${match.itemId}-${idx}`}
                    className="flex items-start gap-3 p-2.5 rounded-lg bg-gray-50 border"
                  >
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium shrink-0 mt-0.5 ${cfg.color}`}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug">
                        {highlightMatch(match.text || "", searchQuery)}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                        {match.extra && (
                          <span className="text-xs text-muted-foreground">
                            {match.type === "timesheet-note" ? `By ${match.extra}` : match.extra}
                          </span>
                        )}
                        {match.amount && parseFloat(match.amount) > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {match.type === "timesheet-note"
                              ? `${match.amount} hrs`
                              : `$${parseFloat(match.amount).toFixed(2)}`}
                          </span>
                        )}
                        {match.date && (
                          <span className="text-xs text-muted-foreground">{match.date}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
