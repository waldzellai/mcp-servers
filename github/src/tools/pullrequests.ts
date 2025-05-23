import { z } from "zod"
import type { Octokit } from "octokit"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerPullRequestTools(server: McpServer, octokit: Octokit) {
	// Tool: Get Pull Request
	server.tool(
		"get_pull_request",
		"Get details of a specific pull request in a GitHub repository.",
		{
			owner: z.string().describe("Repository owner"),
			repo: z.string().describe("Repository name"),
			pullNumber: z.number().describe("Pull request number"),
		},
		async ({ owner, repo, pullNumber }) => {
			try {
				const response = await octokit.rest.pulls.get({
					owner,
					repo,
					pull_number: pullNumber,
				})
				return {
					content: [{ type: "text", text: JSON.stringify(response.data) }],
				}
			} catch (e: any) {
				return {
					content: [{ type: "text", text: `Error: ${e.message}` }],
				}
			}
		},
	)

	// Tool: Update Pull Request
	server.tool(
		"update_pull_request",
		"Update an existing pull request in a GitHub repository.",
		{
			owner: z.string().describe("Repository owner"),
			repo: z.string().describe("Repository name"),
			pullNumber: z.number().describe("Pull request number to update"),
			title: z.string().optional().describe("New title"),
			body: z.string().optional().describe("New description"),
			state: z.enum(["open", "closed"]).optional().describe("New state"),
			base: z.string().optional().describe("New base branch name"),
			maintainer_can_modify: z
				.boolean()
				.optional()
				.describe("Allow maintainer edits"),
		},
		async ({
			owner,
			repo,
			pullNumber,
			title,
			body,
			state,
			base,
			maintainer_can_modify,
		}) => {
			try {
				const response = await octokit.rest.pulls.update({
					owner,
					repo,
					pull_number: pullNumber,
					title,
					body,
					state,
					base,
					maintainer_can_modify,
				})
				return {
					content: [{ type: "text", text: JSON.stringify(response.data) }],
				}
			} catch (e: any) {
				return {
					content: [{ type: "text", text: `Error: ${e.message}` }],
				}
			}
		},
	)

	// Tool: List Pull Requests
	server.tool(
		"list_pull_requests",
		"List pull requests in a GitHub repository.",
		{
			owner: z.string().describe("Repository owner"),
			repo: z.string().describe("Repository name"),
			state: z
				.enum(["open", "closed", "all"])
				.optional()
				.describe("Filter by state"),
			head: z
				.string()
				.optional()
				.describe("Filter by head user/org and branch"),
			base: z.string().optional().describe("Filter by base branch"),
			sort: z
				.enum(["created", "updated", "popularity", "long-running"])
				.optional()
				.describe("Sort by"),
			direction: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
			per_page: z
				.number()
				.optional()
				.default(30)
				.describe("Results per page (default 30, max 100)"),
			page: z
				.number()
				.optional()
				.default(1)
				.describe("Page number (default 1)"),
		},
		async ({
			owner,
			repo,
			state,
			head,
			base,
			sort,
			direction,
			per_page,
			page,
		}) => {
			try {
				const response = await octokit.rest.pulls.list({
					owner,
					repo,
					state,
					head,
					base,
					sort,
					direction,
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
		},
	)

	// Tool: Merge Pull Request
	server.tool(
		"merge_pull_request",
		"Merge a pull request in a GitHub repository.",
		{
			owner: z.string().describe("Repository owner"),
			repo: z.string().describe("Repository name"),
			pullNumber: z.number().describe("Pull request number"),
			commit_title: z.string().optional().describe("Title for merge commit"),
			commit_message: z
				.string()
				.optional()
				.describe("Extra detail for merge commit"),
			merge_method: z
				.enum(["merge", "squash", "rebase"])
				.optional()
				.describe("Merge method"),
		},
		async ({
			owner,
			repo,
			pullNumber,
			commit_title,
			commit_message,
			merge_method,
		}) => {
			try {
				const response = await octokit.rest.pulls.merge({
					owner,
					repo,
					pull_number: pullNumber,
					commit_title,
					commit_message,
					merge_method,
				})
				return {
					content: [{ type: "text", text: JSON.stringify(response.data) }],
				}
			} catch (e: any) {
				return {
					content: [{ type: "text", text: `Error: ${e.message}` }],
				}
			}
		},
	)

	// Tool: Get Pull Request Files
	server.tool(
		"get_pull_request_files",
		"Get the files changed in a specific pull request.",
		{
			owner: z.string().describe("Repository owner"),
			repo: z.string().describe("Repository name"),
			pullNumber: z.number().describe("Pull request number"),
			per_page: z
				.number()
				.optional()
				.default(30)
				.describe("Results per page (default 30, max 100)"),
			page: z
				.number()
				.optional()
				.default(1)
				.describe("Page number (default 1)"),
		},
		async ({ owner, repo, pullNumber, per_page, page }) => {
			try {
				const response = await octokit.rest.pulls.listFiles({
					owner,
					repo,
					pull_number: pullNumber,
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
		},
	)

	// Tool: Get Pull Request Status (combined status for head SHA)
	server.tool(
		"get_pull_request_status",
		"Get the status of a specific pull request.",
		{
			owner: z.string().describe("Repository owner"),
			repo: z.string().describe("Repository name"),
			pullNumber: z.number().describe("Pull request number"),
		},
		async ({ owner, repo, pullNumber }) => {
			try {
				// Get the PR to find the head SHA
				const prResp = await octokit.rest.pulls.get({
					owner,
					repo,
					pull_number: pullNumber,
				})
				const sha = prResp.data.head.sha
				const statusResp = await octokit.rest.repos.getCombinedStatusForRef({
					owner,
					repo,
					ref: sha,
				})
				return {
					content: [{ type: "text", text: JSON.stringify(statusResp.data) }],
				}
			} catch (e: any) {
				return {
					content: [{ type: "text", text: `Error: ${e.message}` }],
				}
			}
		},
	)

	// Tool: Update Pull Request Branch (stub, not implemented)
	server.tool(
		"update_pull_request_branch",
		"Update the branch of a pull request with the latest changes from the base branch (not implemented)",
		{
			owner: z.string().describe("Repository owner"),
			repo: z.string().describe("Repository name"),
			pullNumber: z.number().describe("Pull request number"),
			expectedHeadSha: z
				.string()
				.optional()
				.describe("The expected SHA of the pull request's HEAD ref"),
		},
		async () => {
			return {
				content: [{ type: "text", text: "Not implemented yet" }],
			}
		},
	)

	// Tool: Get Pull Request Comments (stub, not implemented)
	server.tool(
		"get_pull_request_comments",
		"Get comments for a specific pull request (not implemented)",
		{
			owner: z.string().describe("Repository owner"),
			repo: z.string().describe("Repository name"),
			pullNumber: z.number().describe("Pull request number"),
		},
		async () => {
			return {
				content: [{ type: "text", text: "Not implemented yet" }],
			}
		},
	)

	// Tool: Create Pull Request
	server.tool(
		"create_pull_request",
		"Create a new pull request in a GitHub repository.",
		{
			owner: z.string().describe("Repository owner"),
			repo: z.string().describe("Repository name"),
			title: z.string().describe("PR title"),
			body: z.string().optional().describe("PR description"),
			head: z.string().describe("Branch containing changes"),
			base: z.string().describe("Branch to merge into"),
			draft: z.boolean().optional().describe("Create as draft PR"),
			maintainer_can_modify: z
				.boolean()
				.optional()
				.describe("Allow maintainer edits"),
		},
		async ({
			owner,
			repo,
			title,
			body,
			head,
			base,
			draft,
			maintainer_can_modify,
		}) => {
			try {
				const response = await octokit.rest.pulls.create({
					owner,
					repo,
					title,
					body,
					head,
					base,
					draft,
					maintainer_can_modify,
				})
				return {
					content: [{ type: "text", text: JSON.stringify(response.data) }],
				}
			} catch (e: any) {
				return {
					content: [{ type: "text", text: `Error: ${e.message}` }],
				}
			}
		},
	)
}
