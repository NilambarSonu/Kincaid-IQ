import { ReplitConnectors } from "@replit/connectors-sdk";

const connectors = new ReplitConnectors();

export async function getRepoContent(owner: string, repo: string, path: string = "") {
  try {
    const response = await connectors.proxy("github", `/repos/${owner}/${repo}/contents/${path}`, {
      method: "GET",
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to fetch from GitHub");
    }
    
    return await response.json();
  } catch (error) {
    console.error("GitHub API Error:", error);
    throw error;
  }
}

export async function listUserRepos() {
  try {
    const response = await connectors.proxy("github", "/user/repos", {
      method: "GET",
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to fetch user repos");
    }
    
    return await response.json();
  } catch (error) {
    console.error("GitHub API Error:", error);
    throw error;
  }
}
