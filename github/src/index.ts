#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Octokit } from "octokit"
import { z } from "zod"
import { registerIssueTools } from "./tools/issues.js"
import { registerPullRequestTools } from "./tools/pullrequests.js"
import { registerRepositoryTools } from "./tools/repositories.js"
import { registerSearchTools } from "./tools/search.js"

export const configSchema = z.object({
	githubPersonalAccessToken: z.string(),
})

export function createStatelessServer(config: z.infer<typeof configSchema>) {
	try {
		console.log("Starting GitHub MCP Server...")

		// Create a new MCP server
		const server = new McpServer({
			name: "GitHub MCP Server",
			version: "1.0.0",
		})

		// Initialize Octokit client
		const octokit = new Octokit({ auth: config.githubPersonalAccessToken })

		// Register tool groups
		registerSearchTools(server, octokit)
		registerIssueTools(server, octokit)
		registerRepositoryTools(server, octokit)
		registerPullRequestTools(server, octokit)

		return server.server
	} catch (e) {
		console.error(e)
		throw e
	}
}
