import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Client } from "@notionhq/client"
import type {
	DatabaseObjectResponse,
	PageObjectResponse,
	PartialDatabaseObjectResponse,
	PartialPageObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js"
import { z } from "zod"
import { formatToolResponse, getErrorMessage } from "./utils.js"

type SearchResult =
	| PageObjectResponse
	| DatabaseObjectResponse
	| PartialPageObjectResponse
	| PartialDatabaseObjectResponse

function extractTitle(item: SearchResult): string {
	if ("title" in item && item.title && Array.isArray(item.title)) {
		return item.title.map((t) => t.plain_text).join("") || "Untitled"
	}
	if ("properties" in item && item.properties && "title" in item.properties) {
		const titleProp = item.properties.title
		if (titleProp && "title" in titleProp && Array.isArray(titleProp.title)) {
			return titleProp.title.map((t) => t.plain_text).join("") || "Untitled"
		}
	}
	return "Untitled"
}

export function registerSearchTools(server: McpServer, notion: Client) {
	// Tool: Search Notion
	server.tool(
		"search",
		"Search for pages and databases in Notion by title or content. Returns page/database metadata. To retrieve actual page content after finding it, use get-block-children with the page ID. To get comments on a page, use get-comments with the page ID.",
		{
			query: z.string().optional().describe("Search query"),
			filter: z
				.object({
					value: z.enum(["page", "database"]),
					property: z.literal("object"),
				})
				.optional()
				.describe("Filter by object type"),
			sort: z
				.object({
					direction: z.enum(["ascending", "descending"]),
					timestamp: z.enum(["last_edited_time"]),
				})
				.optional()
				.describe("Sort results"),
			start_cursor: z.string().optional().describe("Pagination cursor"),
			page_size: z
				.number()
				.min(1)
				.max(100)
				.optional()
				.default(10)
				.describe("Number of results per page"),
		},
		async ({ query, filter, sort, start_cursor, page_size }) => {
			try {
				const searchParams: Record<string, unknown> = {}

				if (query) {
					searchParams.query = query
				}

				if (filter) {
					searchParams.filter = filter
				}

				if (sort) {
					searchParams.sort = sort
				}

				if (start_cursor) {
					searchParams.start_cursor = start_cursor
				}

				if (page_size !== undefined) {
					searchParams.page_size = page_size
				}

				const response = await notion.search(searchParams)

				const result = {
					object: "list",
					has_more: response.has_more,
					next_cursor: response.next_cursor,
					total: response.results.length,
					results: response.results.map((item: SearchResult) => ({
						id: item.id,
						object: item.object,
						created_time:
							"created_time" in item ? item.created_time : undefined,
						last_edited_time:
							"last_edited_time" in item ? item.last_edited_time : undefined,
						title: extractTitle(item),
						url: "url" in item ? item.url : undefined,
					})),
				}

				return formatToolResponse(result)
			} catch (error: unknown) {
				return formatToolResponse(
					null,
					`performing search: ${getErrorMessage(error)}`,
				)
			}
		},
	)
}
