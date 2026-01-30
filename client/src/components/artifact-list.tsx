import { useEffect, useState } from "react";
import { listArtifacts } from "@/lib/api";
import type { ArtifactRecord } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
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
  HelpCircle
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

export function ArtifactList({ selectedId, onSelect, refreshSignal, onCreateNew }: ArtifactListProps) {
  const [artifacts, setArtifacts] = useState<ArtifactRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  async function load(first = false) {
    setError(null);
    if (first) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }
    
    try {
      const result = await listArtifacts(20, first ? null : nextCursor);
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
  }, [refreshSignal]);

  function getTypeIcon(type: string) {
    const Icon = TYPE_ICONS[type] || FileText;
    return <Icon className="h-4 w-4" />;
  }

  return (
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      <div className="p-4 border-b border-sidebar-border space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-sidebar-foreground">Artifacts</h2>
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
                        variant={artifact.status === "complete" ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {artifact.status === "complete" ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Complete</>
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
