import os
from dotenv import load_dotenv
from google.adk.agents import LlmAgent
from google.adk.tools.mcp_tool import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPServerParams

from pattern_detection import propose_workflow_tool

load_dotenv()

mcp_toolset = McpToolset(
    connection_params=StreamableHTTPServerParams(
        url=os.environ['MCP_URL'],
        headers={"Authorization": f"Bearer {os.environ['MCP_TOKEN']}"},
    ),
)

INSTRUCTION = """\
You are the POW Ledger Verification Agent. You verify provenance entries and
detect repeating decision patterns that should be promoted into reusable workflows.

WORKFLOW:
1. When asked about an artifact, call get_lineage to fetch its decision chain.
2. For each entry in the chain, call verify_entry to confirm cryptographic integrity.
3. After verification, ALWAYS call propose_workflow on the full decision list.
4. If propose_workflow returns proposed=true, surface the template to the user
   with: pattern length, number of occurrences, suggested name, and steps.
   Frame it as a PROPOSAL requiring human approval — never as an executed action.
5. If integrity verification fails on any entry, stop and report the failure
   prominently. Do not propose workflows from a corrupted chain.

Be concise. Use bullet points for verification results. Always cite entry IDs.
"""

root_agent = LlmAgent(
    name="verification_agent",
    model="gemini-2.5-flash",
    instruction=INSTRUCTION,
    tools=[mcp_toolset, propose_workflow_tool],
)
