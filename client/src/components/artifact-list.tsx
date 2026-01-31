import { useEffect, useState, useMemo } from "react";
import { listArtifacts, type ListArtifactsFilters } from "@/lib/api";
import type { ArtifactRecord, ArtifactType } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  RefreshCw, 
  Plus, 
  FileText, 
  CheckCircle2, 
  Clock,
  ChevronDown,
  FileCode,
  BookOpen,
  ListChecks,
  Workflow,
  FileEdit,
  BookMarked,
  Lightbulb,
  BookOpenText,
  HelpCircle,
  Search,
  Archive,
  Filter,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface ArtifactListProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  refreshSignal: number;
  onCreateNew: () => void;
}

const TYPE_ICONS: Record<string, React.ElementType> = {
  note: FileText,
  sop: BookOpen,
  checklist: ListChecks,
  playbook: BookMarked,
  template: FileCode,
  workflow: Workflow,
  spec: FileEdit,
  principles: Lightbulb,
  journal: BookOpenText,
  other: HelpCircle,
};

const ARTIFACT_TYPES: ArtifactType[] = [
  "note", "sop", "checklist", "playbook", "template", 
  "workflow", "spec", "principles", "journal", "other"
];

export function ArtifactList({ selectedId, onSelect, refreshSignal, onCreateNew }: ArtifactListProps) {
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [showFilters, setShowFilters] = useState(false);

  const filters: ListArtifactsFilters = useMemo(() => {
    const f: ListArtifactsFilters = {};
    if (searchQuery.trim()) f.search = searchQuery.trim();
    if (typeFilter !== "all") f.type = typeFilter as ArtifactType;
    if (statusFilter === "draft") f.status = "draft";
    else if (statusFilter === "complete") f.status = "complete";
    else if (statusFilter === "archived") f.status = "archived";
    else if (statusFilter === "all") f.includeArchived = true;
    return f;
  }, [searchQuery, typeFilter, statusFilter]);

  async function load(first = false) {
    setError(null);
    if (first) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      const result = await listArtifacts(20, first ? null : nextCursor, filters);
      setArtifacts((prev) => (first ? result.artifacts : [...prev, ...result.artifacts]));
      setNextCursor(result.nextCursor);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  useEffect(() => {
    load(true);
  }, [refreshSignal, filters]);

  function getTypeIcon(type: string) {
    const Icon = TYPE_ICONS[type] || FileText;
    return <Icon className="h-4 w-4" />;
  }

  const hasActiveFilters = typeFilter !== "all" || statusFilter !== "active";

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      <div className="p-4 border-b border-sidebar-border space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-sidebar-foreground">Artifacts</h2>
          <div className="flex items-center gap-1">
            <Button
              variant={showFilters ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => load(true)}
              disabled={isLoading}
              data-testid="button-refresh-list"
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search artifacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-8"
            data-testid="input-search"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
        
        {showFilters && (
          <div className="space-y-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full" data-testid="select-type-filter">
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {ARTIFACT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full" data-testid="select-status-filter">
                <SelectValue placeholder="Active" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active (Draft + Complete)</SelectItem>
                <SelectItem value="draft">Drafts only</SelectItem>
                <SelectItem value="complete">Complete only</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
            
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setTypeFilter("all");
                  setStatusFilter("active");
                }}
              >
                <X className="h-3 w-3 mr-1" />
                Clear filters
              </Button>
            )}
          </div>
        )}
        
        <Button 
          className="w-full" 
          onClick={onCreateNew}
          data-testid="button-create-artifact"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Artifact
        </Button>
      </div>
      
      {error && (
        <div className="p-3 m-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm" data-testid="text-list-error">
          {error}
        </div>
      )}
      
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))
          ) : artifacts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No artifacts yet</p>
              <p className="text-xs mt-1">Create your first artifact to get started</p>
            </div>
          ) : (
            artifacts.map((artifact) => (
              <Card
                key={artifact.id}
                onClick={() => onSelect(artifact.id)}
                className={cn(
                  "p-3 cursor-pointer transition-colors hover-elevate",
                  selectedId === artifact.id 
                    ? "bg-sidebar-accent border-sidebar-accent-border" 
                    : "bg-transparent border-transparent hover:bg-sidebar-accent/50"
                )}
                data-testid={`card-artifact-${artifact.id}`}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    "p-2 rounded-md",
                    artifact.status === "complete" 
                      ? "bg-green-500/10 text-green-600 dark:text-green-400" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    {getTypeIcon(artifact.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate text-sidebar-foreground" data-testid={`text-artifact-title-${artifact.id}`}>
                      {artifact.title || "Untitled"}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge 
                        variant={artifact.status === "complete" ? "default" : artifact.status === "archived" ? "outline" : "secondary"}
                        className="text-xs"
                      >
                        {artifact.status === "complete" ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Complete</>
                        ) : artifact.status === "archived" ? (
                          <><Archive className="h-3 w-3 mr-1" /> Archived</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-1" /> Draft</>
                        )}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(artifact.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
        
        {nextCursor && !isLoading && (
          <div className="p-3">
            <Button
              variant="ghost"
              className="w-full"
              onClick={() => load(false)}
              disabled={isLoadingMore}
              data-testid="button-load-more"
            >
              {isLoadingMore ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4 mr-2" />
              )}
              Load more
            </Button>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
