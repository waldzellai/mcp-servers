import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Client } from "@notionhq/client"
import { isFullPage } from "@notionhq/client"
import { z } from "zod"
import {
	cleanNotionId,
	extractPageProperties,
	formatToolResponse,
	getErrorMessage,
} from "./utils.js"

export function registerPageTools(server: McpServer, notion: Client) {
	// Tool: Get Page
	server.tool(
		"get_page",
		"Get a Notion page by ID. Returns page metadata and properties, but NOT the actual content blocks. To get page content, use get-block-children with the page ID.",
		{
			page_id: z.string().describe("The ID of the page to retrieve"),
		},
		async ({ page_id }) => {
			try {
				const response = await notion.pages.retrieve({
					page_id: cleanNotionId(page_id),
				})

				if (!isFullPage(response)) {
					throw new Error("Failed to retrieve page")
				}

				const pageData = {
					id: response.id,
					properties: extractPageProperties(response),
					created_time: response.created_time,
					last_edited_time: response.last_edited_time,
				}

				return formatToolResponse(pageData)
			} catch (error: unknown) {
				return formatToolResponse(null, getErrorMessage(error))
			}
		},
	)

	// Tool: Create Page
	server.tool(
		"create-page",
		"Create a new Notion page in a specific parent page or database",
		{
			title: z.string().describe("Title of the new page"),
			parent_id: z.string().describe("ID of the parent page or database"),
			parent_type: z
				.enum(["page", "database"])
				.describe("Type of parent - either 'page' or 'database'"),
			properties: z
				.record(z.unknown())
				.optional()
				.describe("Additional properties for the page (for database pages)"),
			children: z
				.array(z.record(z.unknown()))
				.optional()
				.describe("Initial content blocks for the page"),
		},
		async ({ parent_id, parent_type, title, properties, children }) => {
			try {
				const parent =
					parent_type === "database"
						? { database_id: cleanNotionId(parent_id) }
						: { page_id: cleanNotionId(parent_id) }

				const pageProperties = {
					title: {
						title: [
							{
								text: {
									content: title,
								},
							},
						],
					},
					...(properties || {}),
				}

				const createParams = {
					parent,
					properties: pageProperties,
					...(children && { children }),
				} as Parameters<typeof notion.pages.create>[0]

				const response = await notion.pages.create(createParams)

				if (!isFullPage(response)) {
					throw new Error("Failed to create page")
				}

				const pageData = {
					id: response.id,
					properties: extractPageProperties(response),
				}

				return formatToolResponse(pageData)
			} catch (error: unknown) {
				return formatToolResponse(null, getErrorMessage(error))
			}
		},
	)

	// Tool: Update Page
	server.tool(
		"update_page",
		"Update an existing page's properties",
		{
			page_id: z.string().describe("ID of the page to update"),
			properties: z.record(z.unknown()).describe("Properties to update"),
		},
		async ({ page_id, properties }) => {
			try {
				const updateParams = {
					page_id: cleanNotionId(page_id),
					properties,
				} as Parameters<typeof notion.pages.update>[0]

				const response = await notion.pages.update(updateParams)

				if (!isFullPage(response)) {
					throw new Error("Failed to update page")
				}

				const pageData = {
					id: response.id,
					last_edited_time: response.last_edited_time,
					properties: extractPageProperties(response),
				}

				return formatToolResponse(pageData)
			} catch (error: unknown) {
				return formatToolResponse(null, getErrorMessage(error))
			}
		},
	)
}
