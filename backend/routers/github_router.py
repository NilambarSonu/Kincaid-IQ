import os
from fastapi import APIRouter, HTTPException, Request
from typing import Optional

router = APIRouter(prefix="/api/github", tags=["github"])


def get_github_client():
    try:
        from replit.object_storage import Client
    except ImportError:
        pass

    # Import the Replit Connectors SDK approach — requires a JS bridge
    # For now, return None and fall back to direct API calls if possible
    return None


async def fetch_github(path: str, token: Optional[str] = None):
    import httpx
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    async with httpx.AsyncClient() as client:
        response = await client.get(f"https://api.github.com/{path}", headers=headers)
        if response.status_code == 401:
            raise HTTPException(status_code=401, detail="GitHub authentication required")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"GitHub API error: {response.text}")
        return response.json()


@router.get("/repos")
async def list_repos(request: Request):
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_ACCESS_TOKEN")
    if not token:
        return {"error": "GitHub token not configured. Use the GitHub integration to connect.", "repos": []}
    try:
        repos = await fetch_github("user/repos?sort=updated&per_page=20", token)
        return {"repos": repos}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/repos/{owner}/{repo}/contents")
async def get_repo_contents(owner: str, repo: str, path: str = ""):
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_ACCESS_TOKEN")
    api_path = f"repos/{owner}/{repo}/contents/{path}" if path else f"repos/{owner}/{repo}/contents"
    try:
        contents = await fetch_github(api_path, token)
        return contents
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
