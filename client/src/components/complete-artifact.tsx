import { useState } from "react";
import { completeArtifact } from "@/lib/api";
import type { ArtifactRecord, RTVResponse } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Loader2, CheckCircle, Trophy, Lock, Unlock, Tag } from "lucide-react";

interface CompleteArtifactProps {
  artifact: ArtifactRecord | null;
  onComplete: (artifact: ArtifactRecord, snapshotId: string, rtv: RTVResponse) => void;
  onCancel: () => void;
  open: boolean;
}

export function CompleteArtifact({ artifact, onComplete, onCancel, open }: CompleteArtifactProps) {
  const [finishSummary, setFinishSummary] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleComplete() {
    if (!artifact) return;
    setError(null);
    setIsSubmitting(true);
    
    try {
      const result = await completeArtifact(artifact.id, { 
        finishSummary: finishSummary.trim() 
      });
      setFinishSummary("");
      onComplete(result.artifact, result.snapshotId, result.rtv);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      setError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!artifact) return null;

  const canComplete = artifact.status === "draft" && finishSummary.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Complete Artifact
          </DialogTitle>
          <DialogDescription>
            Mark "{artifact.title}" as complete. This will create an immutable snapshot.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {artifact.finishCriteria && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Finish Criteria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {artifact.finishCriteria.doneDefinition}
                </p>
                <div className="space-y-1">
                  {artifact.finishCriteria.checks.map((check, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                      <span>{check}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <Label htmlFor="finishSummary">Finish Summary</Label>
            <Textarea
              id="finishSummary"
              placeholder="Summarize what was accomplished (min 10 characters)..."
              value={finishSummary}
              onChange={(e) => setFinishSummary(e.target.value)}
              rows={4}
              data-testid="textarea-finish-summary"
            />
            <p className="text-xs text-muted-foreground">
              {finishSummary.length}/10 characters minimum
            </p>
          </div>

          {error && (
            <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm" data-testid="text-complete-error">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleComplete} disabled={!canComplete || isSubmitting} data-testid="button-confirm-complete">
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Completing...</>
            ) : (
              <><CheckCircle className="mr-2 h-4 w-4" /> Complete</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RTVStatusProps {
  rtv: RTVResponse | null;
}

export function RTVStatus({ rtv }: RTVStatusProps) {
  if (!rtv) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {rtv.locked ? (
            <Lock className="h-4 w-4 text-amber-500" />
          ) : (
            <Unlock className="h-4 w-4 text-green-500" />
          )}
          RTV Status
        </CardTitle>
        <CardDescription>
          {rtv.eligible 
            ? "This artifact is eligible for RTV tagging" 
            : rtv.reason 
              ? `Not eligible: ${rtv.reason.replace(/_/g, " ")}` 
              : "Not eligible for RTV tagging"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {rtv.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {rtv.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {tag.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        )}
        
        {rtv.unlock && (
          <div className="space-y-2 text-sm">
            <p className="font-medium">
              {rtv.unlock.unlocked ? "RTV Unlocked" : "Unlock Requirements"}
            </p>
            <div className="grid gap-1 text-muted-foreground">
              <div className="flex justify-between">
                <span>Completed Artifacts</span>
                <span>{rtv.unlock.requirements.completedArtifacts.have}/{rtv.unlock.requirements.completedArtifacts.need}</span>
              </div>
              <div className="flex justify-between">
                <span>Distinct Modes</span>
                <span>{rtv.unlock.requirements.distinctModes.have}/{rtv.unlock.requirements.distinctModes.need}</span>
              </div>
              <div className="flex justify-between">
                <span>Revisions Created</span>
                <span>{rtv.unlock.requirements.revisionsCreated.have}/{rtv.unlock.requirements.revisionsCreated.need}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
