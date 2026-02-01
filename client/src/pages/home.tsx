import { useState, useCallback, useEffect } from "react";
import { ArtifactList } from "@/components/artifact-list";
import { ArtifactEditor } from "@/components/artifact-editor";
import { ProofUnits } from "@/components/proof-units";
import { CompleteArtifact, RTVStatus } from "@/components/complete-artifact";
import { SnapshotView } from "@/components/snapshot-view";
import { ActivityLog } from "@/components/activity-log";
import { ManualDialog } from "@/components/manual-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getArtifact, getUserId, clearToken, clearUserId, type ArtifactGetResponse } from "@/lib/api";
import type { ArtifactRecord, ArtifactSnapshotRecord, RTVResponse } from "@shared/schema";
import { 
  Zap, 
  LogOut, 
  FileEdit, 
  CheckCircle2, 
  Sparkles,
  Menu,
  Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface HomeProps {
  onLogout: () => void;
}

export default function Home({ onLogout }: HomeProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refreshSignal, setRefreshSignal] = useState(0);
  const [activeTab, setActiveTab] = useState<"edit" | "proof" | "complete">("edit");
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  
  const [currentArtifact, setCurrentArtifact] = useState<ArtifactRecord | null>(null);
  const [currentSnapshot, setCurrentSnapshot] = useState<ArtifactSnapshotRecord | null>(null);
  const [currentRTV, setCurrentRTV] = useState<RTVResponse | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  const userId = getUserId();

  const refreshList = useCallback(() => {
    setRefreshSignal((n) => n + 1);
  }, []);

  const handleSelect = useCallback((id: string | null) => {
    setSelectedId(id);
    setMobileMenuOpen(false);
    if (id) {
      loadArtifactDetails(id);
    } else {
      setCurrentArtifact(null);
      setCurrentSnapshot(null);
      setCurrentRTV(null);
    }
  }, []);

  async function loadArtifactDetails(id: string) {
    setIsLoadingDetails(true);
    try {
      const result = await getArtifact(id);
      setCurrentArtifact(result.artifact);
      setCurrentRTV(result.rtv);
      if ("snapshot" in result) {
        setCurrentSnapshot(result.snapshot);
      } else {
        setCurrentSnapshot(null);
      }
    } catch (e) {
      console.error("Failed to load artifact details:", e);
    } finally {
      setIsLoadingDetails(false);
    }
  }

  const handleCreateNew = useCallback(() => {
    setSelectedId(null);
    setCurrentArtifact(null);
    setCurrentSnapshot(null);
    setCurrentRTV(null);
    setActiveTab("edit");
    setMobileMenuOpen(false);
  }, []);

  const handleCreated = useCallback((id: string) => {
    setSelectedId(id);
    loadArtifactDetails(id);
    setActiveTab("proof");
  }, []);

  const handleComplete = useCallback((artifact: ArtifactRecord, snapshotId: string, rtv: RTVResponse) => {
    setIsCompleteDialogOpen(false);
    setCurrentArtifact(artifact);
    setCurrentRTV(rtv);
    refreshList();
    loadArtifactDetails(artifact.id);
  }, [refreshList]);

  const handleRevise = useCallback((newArtifact: ArtifactRecord) => {
    setSelectedId(newArtifact.id);
    loadArtifactDetails(newArtifact.id);
    refreshList();
    setActiveTab("edit");
  }, [refreshList]);

  const handleLogout = useCallback(() => {
    clearToken();
    clearUserId();
    onLogout();
  }, [onLogout]);

  const handleArchiveChange = useCallback(() => {
    refreshList();
    setSelectedId(null);
    setCurrentArtifact(null);
    setCurrentSnapshot(null);
    setCurrentRTV(null);
  }, [refreshList]);

  useEffect(() => {
    if (currentArtifact?.status === "complete") {
      setActiveTab("edit");
    }
  }, [currentArtifact?.status]);

  const isComplete = currentArtifact?.status === "complete" || currentArtifact?.status === "archived";

  const sidebarContent = (
    <ArtifactList
      selectedId={selectedId}
      onSelect={handleSelect}
      refreshSignal={refreshSignal}
      onCreateNew={handleCreateNew}
    />
  );

  return (
    <div className="flex h-screen bg-background">
      <div className="hidden md:flex w-80 flex-shrink-0">
        {sidebarContent}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between gap-2 px-4 py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-3">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button variant="ghost" size="icon" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-80">
                {sidebarContent}
              </SheetContent>
            </Sheet>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <span className="font-semibold hidden sm:inline">POW</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline" data-testid="text-user-id">
              {userId}
            </span>
            <ManualDialog />
            <Button 
              variant={showActivityLog ? "secondary" : "ghost"} 
              size="icon" 
              onClick={() => setShowActivityLog(!showActivityLog)}
              data-testid="button-activity-log"
            >
              <Activity className="h-4 w-4" />
            </Button>
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-hidden">
            {(currentArtifact?.status === "complete" || currentArtifact?.status === "archived") && currentArtifact ? (
              <ScrollArea className="h-full">
                <SnapshotView
                  artifact={currentArtifact}
                  snapshot={currentSnapshot}
                  rtv={currentRTV}
                  onRevise={handleRevise}
                  onArchiveChange={handleArchiveChange}
                />
              </ScrollArea>
            ) : (
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "edit" | "proof" | "complete")} className="h-full flex flex-col">
              <div className="border-b px-4">
                <TabsList className="h-12">
                  <TabsTrigger value="edit" className="gap-2" data-testid="tab-edit">
                    <FileEdit className="h-4 w-4" />
                    <span className="hidden sm:inline">Editor</span>
                  </TabsTrigger>
                  <TabsTrigger value="proof" className="gap-2" disabled={!selectedId} data-testid="tab-proof">
                    <Sparkles className="h-4 w-4" />
                    <span className="hidden sm:inline">Proof Units</span>
                  </TabsTrigger>
                  <TabsTrigger value="complete" className="gap-2" disabled={!selectedId || isComplete} data-testid="tab-complete">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Complete</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-hidden">
                <TabsContent value="edit" className="h-full m-0 data-[state=active]:flex flex-col">
                  <ScrollArea className="flex-1">
                    <ArtifactEditor
                      artifactId={selectedId}
                      onCreated={handleCreated}
                      refreshList={refreshList}
                    />
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="proof" className="h-full m-0 data-[state=active]:flex flex-col">
                  <ScrollArea className="flex-1">
                    <div className="p-6 max-w-2xl">
                      <ProofUnits 
                        artifactId={selectedId} 
                        onProofAdded={refreshList}
                      />
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="complete" className="h-full m-0 data-[state=active]:flex flex-col">
                  <ScrollArea className="flex-1">
                    <div className="p-6 max-w-2xl space-y-6">
                      {currentArtifact && (
                        <>
                          <div className="space-y-2">
                            <h3 className="text-lg font-semibold">Complete Artifact</h3>
                            <p className="text-sm text-muted-foreground">
                              Mark "{currentArtifact.title}" as complete. This will create an immutable snapshot.
                            </p>
                          </div>
                          
                          <Button 
                            onClick={() => setIsCompleteDialogOpen(true)}
                            className="w-full"
                            data-testid="button-open-complete"
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Complete Artifact
                          </Button>
                          
                          <RTVStatus rtv={currentRTV} />
                        </>
                      )}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </div>
            </Tabs>
            )}
          </div>

          {showActivityLog && (
            <div className="hidden lg:block w-80 border-l overflow-hidden">
              <ActivityLog refreshSignal={refreshSignal} />
            </div>
          )}
        </div>
      </div>

      <CompleteArtifact
        artifact={currentArtifact}
        onComplete={handleComplete}
        onCancel={() => setIsCompleteDialogOpen(false)}
        open={isCompleteDialogOpen}
      />
    </div>
  );
}
