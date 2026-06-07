import asyncio
import json
from fastmcp import Client

async def main():
    async with Client('https://pow-mcp-server-878967828995.us-central1.run.app/mcp') as client:
        result = await client.call_tool('list_artifacts', {})
        # result.content is a list of content blocks
        text = result.content[0].text if result.content else "{}"
        data = json.loads(text)
        arts = data['artifacts']['artifacts']
        print(f"Total artifacts: {len(arts)}")
        recent = sorted(arts, key=lambda a: a['createdAt'], reverse=True)[:5]
        for a in recent:
            print(f"  {a['createdAt']} | {a['id']} | {a['title'][:60]}")

asyncio.run(main())
