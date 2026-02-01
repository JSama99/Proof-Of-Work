import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen } from "lucide-react";
import { useState } from "react";

export function ManualDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid="button-manual">
          <BookOpen className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>P.O.W. Manual</DialogTitle>
          <DialogDescription>Proof of Work — A System for Defensible Progress</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 pr-4">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h2>1. What P.O.W. Is (and Is Not)</h2>
            
            <h3>What it is</h3>
            <p>P.O.W. is a system for producing <strong>defensible records of work</strong>.</p>
            <p>It exists to answer questions like:</p>
            <ul>
              <li><em>What exactly did you build?</em></li>
              <li><em>When was it finished?</em></li>
              <li><em>What proof exists that work occurred?</em></li>
              <li><em>What changed between versions?</em></li>
            </ul>
            <p>If you were asked to justify your labor months later, P.O.W. gives you evidence—not explanations.</p>

            <h3>What it is not</h3>
            <p>P.O.W. is <strong>not</strong>:</p>
            <ul>
              <li>a habit tracker</li>
              <li>a streak app</li>
              <li>a task manager</li>
              <li>a motivation engine</li>
            </ul>
            <p>If an app exists to make you <em>feel productive</em>, P.O.W. is not that app.</p>
            <p>P.O.W. exists to make your work <strong>legible and defensible</strong>.</p>

            <h2>2. The Core Principle: Friction Creates Authority</h2>
            <p>Most software removes friction.</p>
            <p>P.O.W. adds <strong>intentional friction</strong> because friction forces:</p>
            <ul>
              <li>decisions</li>
              <li>boundaries</li>
              <li>accountability</li>
            </ul>

            <h4>Example</h4>
            <p>A notes app lets you write endlessly. P.O.W. asks:</p>
            <blockquote>"What are you actually making—and how will you know when it's done?"</blockquote>
            <p>That pause is the point.</p>

            <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">{`LOW FRICTION SYSTEM
Idea → Write → Keep Editing → Feel Busy

P.O.W. SYSTEM
Idea → Define Artifact → Prove Action → Freeze → Authority`}</pre>
            <p>If progress feels slower, authority is being built.</p>

            <h2>3. The Artifact: The Unit of Reality</h2>
            <p>Everything in P.O.W. is an <strong>Artifact</strong>.</p>
            <p>An artifact is:</p>
            <blockquote>A bounded unit of work with a defined purpose and finish condition.</blockquote>

            <h4>Examples of artifacts</h4>
            <ul>
              <li>SOP: "Client onboarding process"</li>
              <li>Checklist: "Deployment checklist"</li>
              <li>Workflow: "Monthly reporting automation"</li>
              <li>Spec: "API integration requirements"</li>
              <li>Principles: "Design standards for brand assets"</li>
            </ul>

            <h4>What is not an artifact</h4>
            <ul>
              <li>loose thoughts</li>
              <li>brainstorming</li>
              <li>mood notes</li>
              <li>unbounded journaling</li>
            </ul>
            <p>Those can exist—but they don't carry authority until completed.</p>

            <h2>4. Artifact States (This Is Critical)</h2>
            <p>Every artifact is always in <strong>one state</strong>.</p>

            <h4>Draft</h4>
            <ul>
              <li>editable</li>
              <li>provisional</li>
              <li>unstable</li>
            </ul>
            <p>Drafts are allowed to be incomplete and wrong.</p>

            <h4>Complete</h4>
            <ul>
              <li>frozen</li>
              <li>immutable</li>
              <li>auditable</li>
            </ul>
            <p>Completed artifacts <strong>cannot be edited</strong>.</p>

            <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">{`[DRAFT] --complete--> [COMPLETE]
   ↑                      |
   |------ revise --------|`}</pre>
            <p>There is <strong>no arrow backward</strong> from Complete to Draft.</p>

            <h2>5. Finish Criteria: Defining "Done"</h2>
            <p>Before an artifact can be completed, "done" must be explicit.</p>
            <p>Finish Criteria include:</p>
            <ol>
              <li><strong>Definition of Done</strong></li>
              <li><strong>Checks</strong> (binary conditions)</li>
            </ol>

            <h4>Example</h4>
            <p>Artifact: <em>Client Onboarding SOP</em></p>
            <p><strong>Definition of Done</strong></p>
            <blockquote>"This SOP is complete when a new team member can onboard a client without asking questions."</blockquote>
            <p><strong>Checks</strong></p>
            <ul>
              <li>Includes step-by-step intake process</li>
              <li>Defines required documents</li>
              <li>Notes edge cases (missing info, delays)</li>
            </ul>
            <p>If you can't articulate this, the artifact is not done.</p>

            <h2>6. Proof Units: Evidence That Action Occurred</h2>
            <p>Writing alone is not proof.</p>
            <p>Before completion, you must log at least one <strong>Proof Unit</strong>.</p>
            <p>A proof unit records:</p>
            <ul>
              <li><strong>Mode</strong>
                <ul>
                  <li>Operator: you did the work</li>
                  <li>Steward: you reviewed, approved, or directed</li>
                </ul>
              </li>
              <li><strong>Type</strong>
                <ul>
                  <li>ship</li>
                  <li>decide</li>
                  <li>document</li>
                  <li>automate</li>
                  <li>review</li>
                </ul>
              </li>
            </ul>

            <h4>Example</h4>
            <p>You write a workflow and then test it.</p>
            <p>Proof Unit:</p>
            <ul>
              <li>Mode: Operator</li>
              <li>Type: Test / Review</li>
              <li>Note: "Ran workflow end-to-end with dummy data."</li>
            </ul>

            <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">{`Artifact Draft
     |
     +-- Proof Unit 1 (document)
     +-- Proof Unit 2 (review)
     |
   Completion allowed`}</pre>
            <p>Proof units do <strong>not</strong> judge quality. They prove that something real happened.</p>

            <h2>7. Completion: The Freeze</h2>
            <p>Completing an artifact is irreversible.</p>
            <p>When you complete:</p>
            <ul>
              <li>the draft body is deleted</li>
              <li>a snapshot is frozen</li>
              <li>status becomes <code>complete</code></li>
              <li>an audit event is recorded</li>
              <li>RTV tags are assigned</li>
            </ul>

            <h4>Example</h4>
            <p>You complete "Client Onboarding SOP."</p>
            <p>What exists afterward:</p>
            <ul>
              <li>Immutable snapshot of the SOP</li>
              <li>Timestamp of completion</li>
              <li>Proof units attached</li>
              <li>Finish summary explaining what changed</li>
            </ul>

            <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">{`[DRAFT BODY]  →  (deleted)
        |
   [SNAPSHOT]
        |
   [COMPLETE]`}</pre>
            <p>If you're unsure, <strong>do not complete</strong>.</p>

            <h2>8. Revision: Improvement Without Erasure</h2>
            <p>You never edit completed work.</p>
            <p>You <strong>revise</strong> it.</p>
            <p>Revision:</p>
            <ul>
              <li>creates a new draft</li>
              <li>copies the snapshot forward</li>
              <li>links to the previous version</li>
            </ul>

            <h4>Example</h4>
            <p>You improve the SOP six months later.</p>
            <p>Result:</p>
            <ul>
              <li>New draft artifact</li>
              <li>Parent artifact + snapshot recorded</li>
              <li>Old version remains authoritative for its time</li>
            </ul>

            <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">{`Artifact v1 (Complete)
        |
      Revise
        |
Artifact v2 (Draft)`}</pre>
            <p>This preserves history and prevents retroactive rewriting.</p>

            <h2>9. RTV (Revenue Translation View): Mapping, Not Advice</h2>
            <p>RTV answers one question:</p>
            <blockquote>"What kinds of value <em>could</em> this artifact translate into?"</blockquote>
            <p>It does <strong>not</strong> tell you:</p>
            <ul>
              <li>what to sell</li>
              <li>how to price</li>
              <li>when to monetize</li>
            </ul>

            <h4>Example RTV output</h4>
            <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">{`RTV STATUS
Eligible: Yes
Locked: No

TRANSLATION MAP
✓ Internal Leverage
✓ Reusable Knowledge
✗ Client-Facing Asset
✗ Automation System`}</pre>
            <p>RTV is observational. It does not prescribe action.</p>

            <h2>10. Authority Over Activity</h2>
            <p>P.O.W. does not reward:</p>
            <ul>
              <li>streaks</li>
              <li>daily usage</li>
              <li>speed</li>
              <li>volume</li>
            </ul>
            <p>It rewards:</p>
            <ul>
              <li>clarity</li>
              <li>completion</li>
              <li>proof</li>
              <li>restraint</li>
            </ul>

            <h4>Example</h4>
            <p>Ten drafts ≠ one completed artifact.</p>
            <p>Only frozen work carries authority.</p>

            <h2>11. Pauses Are Management, Not Failure</h2>
            <p>Life interrupts work.</p>
            <p>P.O.W. treats undocumented absence as ambiguity—but <strong>documented pause as leadership</strong>.</p>

            <h4>Intentional Pause Artifact</h4>
            <blockquote>"I am pausing this cycle for 3 days due to caregiving responsibilities."</blockquote>
            <p>This preserves:</p>
            <ul>
              <li>continuity</li>
              <li>credibility</li>
              <li>command</li>
            </ul>

            <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">{`WORK → PAUSE (logged) → RESUME`}</pre>
            <p>A gap without explanation looks like flakiness. A pause with reason looks like management.</p>

            <h2>12. Scope and Boundary Defense</h2>
            <p>Work expands quietly.</p>
            <p>P.O.W. helps you <strong>record reality</strong>.</p>

            <h4>Scope Creep Flag</h4>
            <p>When logging an artifact:</p>
            <ul>
              <li>"Is this inside the original cycle goal?"
                <ul>
                  <li>Yes</li>
                  <li>No → tagged as Scope Expansion</li>
                </ul>
              </li>
            </ul>

            <h4>Example</h4>
            <p>End of month report:</p>
            <ul>
              <li>12 core artifacts</li>
              <li>7 scope expansions</li>
            </ul>
            <p>This is not confrontation. It's evidence.</p>

            <h2>13. Psychological Safety vs Professional Legibility</h2>
            <p>P.O.W. allows:</p>
            <ul>
              <li>private honesty</li>
              <li>public precision</li>
            </ul>
            <p>Your internal notes can include:</p>
            <ul>
              <li>doubts</li>
              <li>tradeoffs</li>
              <li>mistakes</li>
            </ul>
            <p>Your client export includes:</p>
            <ul>
              <li>decisions</li>
              <li>deliverables</li>
              <li>timelines</li>
              <li>scope markers</li>
            </ul>
            <p>This separation protects both truth and authority.</p>

            <h2>14. Drift: The Mirror</h2>
            <p>P.O.W. does not judge alignment. It shows it.</p>

            <h4>Example</h4>
            <p>Planned:</p>
            <ul>
              <li>70% build</li>
              <li>30% admin</li>
            </ul>
            <p>Logged:</p>
            <ul>
              <li>20% build</li>
              <li>80% admin</li>
            </ul>
            <p>No warning. No scolding. Just a mirror.</p>

            <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto">{`PLANNED:  ███████░░
ACTUAL:   ██░░░░░░░`}</pre>
            <p>Self-correction belongs to the user.</p>

            <h2>15. What Success Looks Like</h2>
            <p>Success is <strong>not</strong>:</p>
            <ul>
              <li>perfect consistency</li>
              <li>maximum output</li>
              <li>constant motion</li>
            </ul>
            <p>Success is:</p>
            <ul>
              <li>a small body of frozen, defensible work</li>
              <li>clear boundaries around labor</li>
              <li>a record you can stand behind later</li>
            </ul>
            <p>If the system feels heavy, it's doing its job.</p>

            <h2>16. The Core Loop (Memorize This)</h2>
            <pre className="bg-muted p-4 rounded-md text-sm overflow-x-auto font-bold">{`DEFINE → ACT → PROVE → FREEZE → REVIEW → REVISE`}</pre>
            <p>Skip a step, and authority collapses.</p>

            <h2>Closing Doctrine</h2>
            <p>P.O.W. exists for people whose labor has been:</p>
            <ul>
              <li>undervalued</li>
              <li>blurred</li>
              <li>extracted</li>
              <li>erased</li>
            </ul>
            <p>This system does not promise success.</p>
            <p>It promises <strong>defensibility</strong>.</p>
            <p>And defensibility is the foundation of leverage.</p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
