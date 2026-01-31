import { useState } from "react";
import { reviseArtifact, archiveArtifact, restoreArtifact } from "@/lib/api";
import type { ArtifactRecord, ArtifactSnapshotRecord, RTVResponse } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  CheckCircle2, 
  Clock, 
  FileText, 
  Loader2, 
  RefreshCw,
  Tag,
  Lock,
  Users,
  ListChecks,
  Download,
  Archive,
  ArchiveRestore
} from "lucide-react";
import { format } from "date-fns";
import { RTVStatus } from "./complete-artifact";

interface SnapshotViewProps {
  artifact: ArtifactRecord;
  snapshot: ArtifactSnapshotRecord | null;
  rtv: RTVResponse | null;
  onRevise: (newArtifact: ArtifactRecord) => void;
  onArchiveChange?: () => void;
}

export function SnapshotView({ artifact, snapshot, rtv, onRevise, onArchiveChange }: SnapshotViewProps) {
  const [isReviseDialogOpen, setIsReviseDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  async function handleRevise() {
    setError(null);
    setIsSubmitting(true);
    
    try {
      const result = await reviseArtifact(artifact.id, { 
        title: newTitle.trim() || undefined 
      });
      setNewTitle("");
      setIsReviseDialogOpen(false);
      onRevise(result.artifact);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleArchive() {
    setIsArchiving(true);
    try {
      await archiveArtifact(artifact.id);
      onArchiveChange?.();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleRestore() {
    setIsArchiving(true);
    try {
      await restoreArtifact(artifact.id);
      onArchiveChange?.();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setIsArchiving(false);
    }
  }

  function handleExport() {
    const displayBody = snapshot?.body ?? artifact.body ?? "";
    const displayFinishSummary = snapshot?.finishSummary ?? artifact.finishSummary;
    
    const markdown = `# ${artifact.title}

**Type:** ${artifact.type}
**Status:** ${artifact.status}
${artifact.completedAt ? `**Completed:** ${format(new Date(artifact.completedAt), "MMMM d, yyyy 'at' h:mm a")}` : ""}

---

${displayFinishSummary ? `## Finish Summary\n\n${displayFinishSummary}\n\n---\n\n` : ""}## Content

${displayBody}
`;

    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${artifact.title.replace(/[^a-zA-Z0-9]/g, "_")}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const displayBody = snapshot?.body ?? artifact.body ?? "";
  const displayFinishCriteria = snapshot?.finishCriteria ?? artifact.finishCriteria;
  const displayFinishSummary = snapshot?.finishSummary ?? artifact.finishSummary;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {artifact.status === "archived" ? (
              <Badge variant="outline" className="text-xs">
                <Archive className="h-3 w-3 mr-1" />
                Archived
              </Badge>
            ) : (
              <Badge variant="default" className="text-xs">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Complete
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {artifact.type}
            </Badge>
          </div>
          <h2 className="text-2xl font-bold" data-testid="text-snapshot-title">{artifact.title}</h2>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              Completed {artifact.completedAt && format(new Date(artifact.completedAt), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button 
            onClick={handleExport}
            variant="outline"
            data-testid="button-export"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
          
          {artifact.status === "archived" ? (
            <Button 
              onClick={handleRestore}
              variant="outline"
              disabled={isArchiving}
              data-testid="button-restore"
            >
              {isArchiving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArchiveRestore className="mr-2 h-4 w-4" />
              )}
              Restore
            </Button>
          ) : (
            <>
              <Button 
                onClick={handleArchive}
                variant="outline"
                disabled={isArchiving}
                data-testid="button-archive"
              >
                {isArchiving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Archive className="mr-2 h-4 w-4" />
                )}
                Archive
              </Button>
              
              <Button 
                onClick={() => setIsReviseDialogOpen(true)}
                variant="outline"
                data-testid="button-revise"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Create Revision
              </Button>
            </>
          )}
        </div>
      </div>

      {artifact.parentArtifactId && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          <span>Revised from artifact: {artifact.parentArtifactId}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {displayFinishSummary && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Finish Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{displayFinishSummary}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Content</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-96">
                <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap font-mono text-sm" data-testid="text-snapshot-body">
                  {displayBody || <span className="text-muted-foreground italic">No content</span>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Structure
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Audience</span>
                <Badge variant="outline">{artifact.structure.audience}</Badge>
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(artifact.structure)
                  .filter(([key]) => key !== "audience")
                  .map(([key, value]) => (
                    <div key={key} className="flex items-center gap-1">
                      <div className={`w-2 h-2 rounded-full ${value ? "bg-green-500" : "bg-muted"}`} />
                      <span className="text-xs truncate">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {displayFinishCriteria && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Finish Criteria
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {displayFinishCriteria.doneDefinition}
                </p>
                <div className="space-y-1">
                  {displayFinishCriteria.checks.map((check, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                      <span>{check}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {artifact.rtvTags && artifact.rtvTags.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  RTV Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {artifact.rtvTags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <RTVStatus rtv={rtv} />
        </div>
      </div>

      <Dialog open={isReviseDialogOpen} onOpenChange={setIsReviseDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Create Revision
            </DialogTitle>
            <DialogDescription>
              Create a new draft based on this completed artifact.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="newTitle">New Title (optional)</Label>
              <Input
                id="newTitle"
                placeholder={`${artifact.title} (Revised)`}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                data-testid="input-revision-title"
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-generate a title
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                {error}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsReviseDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleRevise} disabled={isSubmitting} data-testid="button-confirm-revise">
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
              ) : (
                <><RefreshCw className="mr-2 h-4 w-4" /> Create Revision</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
