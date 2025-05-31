import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { isFullDatabase, isFullPage } from "@notionhq/client"
import type { Client } from "@notionhq/client"
import type {
	CreateDatabaseResponse,
	DatabaseObjectResponse,
	PageObjectResponse,
	UpdateDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints.js"
import { z } from "zod"
import {
	cleanNotionId,
	extractPageProperties,
	formatToolResponse,
	getErrorMessage,
} from "./utils.js"

export function registerDatabaseTools(server: McpServer, notion: Client) {
	// Tool: List Databases
	server.tool(
		"list-databases",
		"List all databases the integration has access to",
		{},
		async () => {
			try {
				const response = await notion.search({
					filter: {
						property: "object",
						value: "database",
					},
					page_size: 100,
					sort: {
						direction: "descending",
						timestamp: "last_edited_time",
					},
				})

				// Extract essential database information
				const databases = response.results
					.filter((item) => item.object === "database")
					.map((db) => {
						if (isFullDatabase(db)) {
							// Find the title property
							let title = "Untitled"
							for (const prop of Object.values(db.properties)) {
								if (
									prop.type === "title" &&
									"title" in prop &&
									Array.isArray(prop.title) &&
									prop.title.length > 0
								) {
									const firstItem = prop.title[0]
									if (firstItem && "plain_text" in firstItem) {
										title = firstItem.plain_text || "Untitled"
										break
									}
								}
							}

							return {
								id: db.id,
								title,
								url: db.url,
								created_time: db.created_time,
								last_edited_time: db.last_edited_time,
								properties: Object.keys(db.properties).length,
							}
						}
						// Partial database response
						return {
							id: db.id,
							title: "Untitled",
							properties: 0,
						}
					})

				return formatToolResponse({
					databases,
					total: databases.length,
				})
			} catch (error: unknown) {
				return formatToolResponse(null, getErrorMessage(error))
			}
		},
	)

	// Tool: Query Database
	server.tool(
		"query-database",
		"Query a database with optional filtering, sorting, and pagination",
		{
			database_id: z.string().describe("ID of the database to query"),
			filter: z
				.record(z.unknown())
				.optional()
				.describe("Optional filter criteria (Notion filter object)"),
			sorts: z
				.array(z.record(z.unknown()))
				.optional()
				.describe("Optional sort criteria (array of Notion sort objects)"),
			start_cursor: z
				.string()
				.optional()
				.describe("Optional cursor for pagination"),
			page_size: z
				.number()
				.optional()
				.default(100)
				.describe("Number of results per page"),
		},
		async ({ database_id, filter, sorts, start_cursor, page_size }) => {
			try {
				const queryParams = {
					database_id: cleanNotionId(database_id),
					page_size,
					...(filter && { filter }),
					...(sorts && { sorts }),
					...(start_cursor && { start_cursor }),
				} as Parameters<typeof notion.databases.query>[0]

				const response = await notion.databases.query(queryParams)

				// Format the response for better readability
				const pages = response.results
					.filter((item) => item.object === "page")
					.map((page) => {
						const properties = isFullPage(page)
							? extractPageProperties(page)
							: {}

						return {
							id: page.id,
							created_time:
								"created_time" in page ? page.created_time : undefined,
							last_edited_time:
								"last_edited_time" in page ? page.last_edited_time : undefined,
							url: "url" in page ? page.url : undefined,
							properties,
						}
					})

				const result = {
					pages,
					has_more: response.has_more,
					next_cursor: response.next_cursor,
				}

				return formatToolResponse(result)
			} catch (error: unknown) {
				return formatToolResponse(null, getErrorMessage(error))
			}
		},
	)

	// Tool: Create Database
	server.tool(
		"create-database",
		"Create a new database in a parent page",
		{
			parent_id: z.string().describe("ID of the parent page"),
			title: z
				.array(
					z.object({
						type: z.literal("text").default("text"),
						text: z.object({
							content: z.string(),
							link: z.object({ url: z.string() }).nullable().optional(),
						}),
						annotations: z
							.object({
								bold: z.boolean().default(false),
								italic: z.boolean().default(false),
								strikethrough: z.boolean().default(false),
								underline: z.boolean().default(false),
								code: z.boolean().default(false),
								color: z
									.enum([
										"default",
										"gray",
										"brown",
										"orange",
										"yellow",
										"green",
										"blue",
										"purple",
										"pink",
										"red",
										"gray_background",
										"brown_background",
										"orange_background",
										"yellow_background",
										"green_background",
										"blue_background",
										"purple_background",
										"pink_background",
										"red_background",
									])
									.default("default"),
							})
							.optional(),
						plain_text: z.string().optional(),
						href: z.string().nullable().optional(),
					}),
				)
				.describe("Database title as rich text array"),
			properties: z
				.record(z.record(z.unknown()))
				.describe("Properties schema for the database"),
			icon: z
				.object({
					type: z.enum(["emoji", "external", "file"]),
					emoji: z.string().optional(),
					external: z.object({ url: z.string() }).optional(),
					file: z.object({ url: z.string() }).optional(),
				})
				.optional()
				.describe("Optional icon configuration"),
			cover: z
				.object({
					type: z.enum(["external", "file"]),
					external: z.object({ url: z.string() }).optional(),
					file: z.object({ url: z.string() }).optional(),
				})
				.optional()
				.describe("Optional cover configuration"),
		},
		async ({ parent_id, title, properties, icon, cover }) => {
			try {
				const cleanParentId = cleanNotionId(parent_id)

				const databaseParams = {
					parent: {
						type: "page_id" as const,
						page_id: cleanParentId,
					},
					title,
					properties,
					...(icon && { icon }),
					...(cover && { cover }),
				} as Parameters<typeof notion.databases.create>[0]

				const response = await notion.databases.create(databaseParams)

				// Handle the response based on whether it's full or partial
				const responseData = isFullDatabase(response)
					? {
							id: response.id,
							title: response.title[0]?.plain_text || "Untitled",
							url: response.url,
							created_time: response.created_time,
						}
					: {
							id: response.id,
							title: "Untitled",
						}

				return formatToolResponse(responseData)
			} catch (error: unknown) {
				return formatToolResponse(null, getErrorMessage(error))
			}
		},
	)

	// Tool: Update Database
	server.tool(
		"update-database",
		"Update an existing database's title, description, or properties",
		{
			database_id: z.string().describe("ID of the database to update"),
			title: z
				.array(
					z.object({
						type: z.literal("text").default("text"),
						text: z.object({
							content: z.string(),
							link: z.object({ url: z.string() }).nullable().optional(),
						}),
						annotations: z
							.object({
								bold: z.boolean().default(false),
								italic: z.boolean().default(false),
								strikethrough: z.boolean().default(false),
								underline: z.boolean().default(false),
								code: z.boolean().default(false),
								color: z
									.enum([
										"default",
										"gray",
										"brown",
										"orange",
										"yellow",
										"green",
										"blue",
										"purple",
										"pink",
										"red",
										"gray_background",
										"brown_background",
										"orange_background",
										"yellow_background",
										"green_background",
										"blue_background",
										"purple_background",
										"pink_background",
										"red_background",
									])
									.default("default"),
							})
							.optional(),
						plain_text: z.string().optional(),
						href: z.string().nullable().optional(),
					}),
				)
				.optional()
				.describe("Optional new title as rich text array"),
			description: z
				.array(
					z.object({
						type: z.literal("text").default("text"),
						text: z.object({
							content: z.string(),
							link: z.object({ url: z.string() }).nullable().optional(),
						}),
						annotations: z
							.object({
								bold: z.boolean().default(false),
								italic: z.boolean().default(false),
								strikethrough: z.boolean().default(false),
								underline: z.boolean().default(false),
								code: z.boolean().default(false),
								color: z
									.enum([
										"default",
										"gray",
										"brown",
										"orange",
										"yellow",
										"green",
										"blue",
										"purple",
										"pink",
										"red",
										"gray_background",
										"brown_background",
										"orange_background",
										"yellow_background",
										"green_background",
										"blue_background",
										"purple_background",
										"pink_background",
										"red_background",
									])
									.default("default"),
							})
							.optional(),
						plain_text: z.string().optional(),
						href: z.string().nullable().optional(),
					}),
				)
				.optional()
				.describe("Optional new description as rich text array"),
			properties: z
				.record(z.record(z.unknown()))
				.optional()
				.describe("Optional updated properties schema"),
		},
		async ({ database_id, title, description, properties }) => {
			try {
				const updateParams = {
					database_id: cleanNotionId(database_id),
					...(title && { title }),
					...(description && { description }),
					...(properties && { properties }),
				} as Parameters<typeof notion.databases.update>[0]

				const response = await notion.databases.update(updateParams)

				// Handle the response based on whether it's full or partial
				const responseData = isFullDatabase(response)
					? {
							id: response.id,
							title: response.title[0]?.plain_text || "Untitled",
							url: response.url,
							last_edited_time: response.last_edited_time,
						}
					: {
							id: response.id,
							last_edited_time:
								"last_edited_time" in response
									? response.last_edited_time
									: undefined,
						}

				return formatToolResponse(responseData)
			} catch (error: unknown) {
				return formatToolResponse(null, getErrorMessage(error))
			}
		},
	)
}
