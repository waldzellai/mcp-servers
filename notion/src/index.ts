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
	notionApiKey: z
		.string()
		.describe(
			"Notion API key, obtained from https://www.notion.so/profile/integrations/",
		),
})

export default function ({ config }: { config: z.infer<typeof configSchema> }) {
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
