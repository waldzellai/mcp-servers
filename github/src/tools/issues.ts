import { z } from "zod"
import { Octokit } from "octokit"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerIssueTools(server: McpServer, octokit: Octokit) {
  // Tool: Get Issue
  server.tool(
    "get_issue",
    "Get details of a specific issue in a GitHub repository.",
    {
      owner: z.string().describe("The owner of the repository"),
      repo: z.string().describe("The name of the repository"),
      issue_number: z.number().describe("The number of the issue"),
    },
    async ({ owner, repo, issue_number }) => {
      try {
        const response = await octokit.rest.issues.get({
          owner,
          repo,
          issue_number,
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

  // Tool: Add Issue Comment
  server.tool(
    "add_issue_comment",
    "Add a comment to a specific issue in a GitHub repository.",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      issue_number: z.number().describe("Issue number to comment on"),
      body: z.string().describe("Comment content"),
    },
    async ({ owner, repo, issue_number, body }) => {
      try {
        const response = await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number,
          body,
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

  // Tool: Search Issues
  server.tool(
    "search_issues",
    "Search for issues in GitHub repositories.",
    {
      q: z.string().describe("Search query using GitHub issues search syntax"),
      sort: z.enum([
        "comments",
        "reactions",
        "reactions-+1",
        "reactions--1",
        "reactions-smile",
        "reactions-thinking_face",
        "reactions-heart",
        "reactions-tada",
        "interactions",
        "created",
        "updated",
      ]).optional().describe("Sort field by number of matches of categories, defaults to best match"),
      order: z.enum(["asc", "desc"]).optional().describe("Sort order"),
      per_page: z.number().optional().default(30).describe("Results per page (default 30, max 100)"),
      page: z.number().optional().default(1).describe("Page number (default 1)"),
    },
    async ({ q, sort, order, per_page, page }) => {
      try {
        const response = await octokit.rest.search.issuesAndPullRequests({
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

  // Tool: Create Issue
  server.tool(
    "create_issue",
    "Create a new issue in a GitHub repository.",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      title: z.string().describe("Issue title"),
      body: z.string().optional().describe("Issue body content"),
      assignees: z.array(z.string()).optional().describe("Usernames to assign to this issue"),
      labels: z.array(z.string()).optional().describe("Labels to apply to this issue"),
      milestone: z.number().optional().describe("Milestone number"),
    },
    async ({ owner, repo, title, body, assignees, labels, milestone }) => {
      try {
        const response = await octokit.rest.issues.create({
          owner,
          repo,
          title,
          body,
          assignees,
          labels,
          milestone,
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

  // Tool: List Issues
  server.tool(
    "list_issues",
    "List issues in a GitHub repository.",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      state: z.enum(["open", "closed", "all"]).optional().describe("Filter by state"),
      labels: z.array(z.string()).optional().describe("Filter by labels"),
      sort: z.enum(["created", "updated", "comments"]).optional().describe("Sort order"),
      direction: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
      since: z.string().optional().describe("Filter by date (ISO 8601 timestamp)"),
      per_page: z.number().optional().default(30).describe("Results per page (default 30, max 100)"),
      page: z.number().optional().default(1).describe("Page number (default 1)"),
    },
    async ({ owner, repo, state, labels, sort, direction, since, per_page, page }) => {
      try {
        const response = await octokit.rest.issues.listForRepo({
          owner,
          repo,
          state,
          labels: labels ? labels.join(",") : undefined,
          sort,
          direction,
          since,
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

  // Tool: Update Issue
  server.tool(
    "update_issue",
    "Update an existing issue in a GitHub repository.",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      issue_number: z.number().describe("Issue number to update"),
      title: z.string().optional().describe("New title"),
      body: z.string().optional().describe("New description"),
      state: z.enum(["open", "closed"]).optional().describe("New state"),
      labels: z.array(z.string()).optional().describe("New labels"),
      assignees: z.array(z.string()).optional().describe("New assignees"),
      milestone: z.number().optional().describe("New milestone number"),
    },
    async ({ owner, repo, issue_number, title, body, state, labels, assignees, milestone }) => {
      try {
        const response = await octokit.rest.issues.update({
          owner,
          repo,
          issue_number,
          title,
          body,
          state,
          labels,
          assignees,
          milestone,
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

  // Tool: Get Issue Comments
  server.tool(
    "get_issue_comments",
    "Get comments for a specific issue in a GitHub repository.",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      issue_number: z.number().describe("Issue number"),
      page: z.number().optional().default(1).describe("Page number"),
      per_page: z.number().optional().default(30).describe("Number of records per page"),
    },
    async ({ owner, repo, issue_number, page, per_page }) => {
      try {
        const response = await octokit.rest.issues.listComments({
          owner,
          repo,
          issue_number,
          page,
          per_page,
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