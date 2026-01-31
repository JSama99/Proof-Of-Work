import { useEffect, useState } from "react";
import { listActivityEvents } from "@/lib/api";
import type { ActivityEventRecord } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  CheckCircle2,
  PlusCircle,
  Edit,
  RefreshCw,
  Archive,
  ArchiveRestore,
  ChevronDown,
  Loader2,
  Activity
} from "lucide-react";
import { format } from "date-fns";

interface ActivityLogProps {
  refreshSignal?: number;
}

const EVENT_ICONS: Record<string, React.ElementType> = {
  created: PlusCircle,
  updated: Edit,
  proof_added: FileText,
  completed: CheckCircle2,
  revised: RefreshCw,
  archived: Archive,
  restored: ArchiveRestore,
};

const EVENT_LABELS: Record<string, string> = {
  created: "Created artifact",
  updated: "Updated artifact",
  proof_added: "Added proof unit",
  completed: "Completed artifact",
  revised: "Created revision",
  archived: "Archived artifact",
  restored: "Restored artifact",
};

export function ActivityLog({ refreshSignal }: ActivityLogProps) {
  const [events, setEvents] = useState<ActivityEventRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  async function load(first = false) {
    if (first) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const result = await listActivityEvents(30, first ? null : nextCursor);
      setEvents((prev) => (first ? result.events : [...prev, ...result.events]));
      setNextCursor(result.nextCursor);
    } catch (e) {
      console.error("Failed to load activity:", e);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  useEffect(() => {
    load(true);
  }, [refreshSignal]);

  function getEventIcon(eventType: string) {
    const Icon = EVENT_ICONS[eventType] || Activity;
    return <Icon className="h-4 w-4" />;
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4" />
          Activity Log
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">No activity yet</p>
              <p className="text-xs mt-1">Your actions will appear here</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex gap-3 items-start"
                  data-testid={`activity-event-${event.id}`}
                >
                  <div className="p-2 rounded-full bg-muted text-muted-foreground flex-shrink-0">
                    {getEventIcon(event.eventType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">
                        {EVENT_LABELS[event.eventType] || event.eventType}
                      </span>
                      {event.metadata?.proofMode && (
                        <Badge variant="outline" className="text-xs">
                          {event.metadata.proofMode}
                        </Badge>
                      )}
                      {event.metadata?.proofType && (
                        <Badge variant="secondary" className="text-xs">
                          {event.metadata.proofType}
                        </Badge>
                      )}
                    </div>
                    {event.metadata?.artifactTitle && (
                      <p className="text-sm text-muted-foreground truncate">
                        {event.metadata.artifactTitle}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(event.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                </div>
              ))}

              {nextCursor && (
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => load(false)}
                  disabled={isLoadingMore}
                  data-testid="button-load-more-activity"
                >
                  {isLoadingMore ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4 mr-2" />
                  )}
                  Load more
                </Button>
              )}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
