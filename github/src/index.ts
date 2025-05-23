#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createStatelessServer } from "@smithery/sdk/server/stateless.js"
import { Octokit } from "octokit"
import { registerSearchTools } from "./tools/search.js"
import { registerIssueTools } from "./tools/issues.js"
import { registerRepositoryTools } from "./tools/repositories.js"
import { registerPullRequestTools } from "./tools/pullrequests.js"

// Create stateless server with GitHub personal token configuration
const { app } = createStatelessServer<{
	githubPersonalAccessToken: string
}>(({ config }) => {
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
})

// Start the server
const PORT = process.env.PORT || 8081
app.listen(PORT, () => {
	console.log(`MCP server running on port ${PORT}`)
})
