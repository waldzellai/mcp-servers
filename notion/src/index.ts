#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { Client } from "@notionhq/client"
import { z } from "zod"
import { registerBlockTools } from "./tools/blocks.js"
import { registerCommentTools } from "./tools/comments.js"
import { registerDatabaseTools } from "./tools/databases.js"
import { registerPageTools } from "./tools/pages.js"
import { registerSearchTools } from "./tools/search.js"

export const configSchema = z.object({
	notionApiKey: z.string(),
})

export function createStatelessServer({
	config,
}: { config: z.infer<typeof configSchema> }) {
	try {
		const server = new McpServer({
			name: "Notion",
			version: "1.0.0",
		})

		const notion = new Client({
			auth: config.notionApiKey,
		})

		// Register all tools
		registerDatabaseTools(server, notion)
		registerPageTools(server, notion)
		registerBlockTools(server, notion)
		registerSearchTools(server, notion)
		registerCommentTools(server, notion)

		return server.server
	} catch (e) {
		console.error(e)
		throw e
	}
}
