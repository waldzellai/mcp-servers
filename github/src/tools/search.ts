import { z } from "zod"
import { Octokit } from "octokit"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerSearchTools(server: McpServer, octokit: Octokit) {
  // Tool: Search Repositories
  server.tool(
    "search_repositories",
    "Search for GitHub repositories",
    {
      query: z.string().describe("Search query"),
      per_page: z.number().optional().default(30).describe("Results per page (default 30, max 100)"),
      page: z.number().optional().default(1).describe("Page number (default 1)"),
    },
    async ({ query, per_page, page }) => {
      try {
        const response = await octokit.rest.search.repos({
          q: query,
          per_page,
          page,
        })
        return {
          content: [{ type: "text", text: JSON.stringify(response.data) }],
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
        }
      }
    }
  )

  // Tool: Search Code
  server.tool(
    "search_code",
    "Search for code across GitHub repositories",
    {
      q: z.string().describe("Search query using GitHub code search syntax"),
      sort: z.enum(["indexed"]).optional().describe("Sort field ('indexed' only)"),
      order: z.enum(["asc", "desc"]).optional().describe("Sort order"),
      per_page: z.number().optional().default(30).describe("Results per page (default 30, max 100)"),
      page: z.number().optional().default(1).describe("Page number (default 1)"),
    },
    async ({ q, sort, order, per_page, page }) => {
      try {
        const response = await octokit.rest.search.code({
          q,
          sort,
          order,
          per_page,
          page,
        })
        return {
          content: [{ type: "text", text: JSON.stringify(response.data) }],
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
        }
      }
    }
  )

  // Tool: Search Users
  server.tool(
    "search_users",
    "Search for GitHub users",
    {
      q: z.string().describe("Search query using GitHub users search syntax"),
      sort: z.enum(["followers", "repositories", "joined"]).optional().describe("Sort field by category"),
      order: z.enum(["asc", "desc"]).optional().describe("Sort order"),
      per_page: z.number().optional().default(30).describe("Results per page (default 30, max 100)"),
      page: z.number().optional().default(1).describe("Page number (default 1)"),
    },
    async ({ q, sort, order, per_page, page }) => {
      try {
        const response = await octokit.rest.search.users({
          q,
          sort,
          order,
          per_page,
          page,
        })
        return {
          content: [{ type: "text", text: JSON.stringify(response.data) }],
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
        }
      }
    }
  )
} 