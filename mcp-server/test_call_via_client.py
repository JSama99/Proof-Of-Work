import asyncio, json
from fastmcp import Client

async def main():
    async with Client('https://pow-mcp-server-878967828995.us-central1.run.app/mcp') as client:
        result = await client.call_tool('append_decision', {
            'title': 'URL fix verification (via Client, bypassing ADK)',
            'body': 'Proving the tool can be invoked over the exact URL the agent is using.',
        })
        text = result.content[0].text if result.content else "{}"
        print("Tool result:")
        print(text[:500])

asyncio.run(main())
