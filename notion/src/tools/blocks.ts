import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Client } from "@notionhq/client"
import { isFullBlock } from "@notionhq/client"
import type {
	BlockObjectRequest,
	BlockObjectResponse,
	PartialBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints.js"
import { z } from "zod"
import {
	cleanNotionId,
	extractTextFromRichText,
	formatToolResponse,
	getErrorMessage,
} from "./utils.js"

interface ExtractedBlockContent {
	id: string
	object: string
	type?: string
	has_children?: boolean
	archived?: boolean
	created_time?: string
	created_by?: { object: string; id: string }
	last_edited_time?: string
	last_edited_by?: { object: string; id: string }
	text?: string
	[key: string]: unknown
}

// Helper function to extract content from a block
function extractBlockContent(
	block: BlockObjectResponse | PartialBlockObjectResponse,
): ExtractedBlockContent {
	const baseInfo: ExtractedBlockContent = {
		id: block.id,
		object: block.object,
	}

	if (!isFullBlock(block)) {
		return baseInfo
	}

	// Add full block properties
	const fullBlockInfo: ExtractedBlockContent = {
		...baseInfo,
		type: block.type,
		has_children: block.has_children,
		archived: block.archived,
		created_time: block.created_time,
		last_edited_time: block.last_edited_time,
		created_by: block.created_by,
		last_edited_by: block.last_edited_by,
		parent: block.parent,
	}

	// Extract content based on block type
	const blockType = block.type

	// Handle different block types
	switch (blockType) {
		case "paragraph":
			return {
				...fullBlockInfo,
				text: extractTextFromRichText(block.paragraph.rich_text),
				color: block.paragraph.color,
			}

		case "heading_1":
			return {
				...fullBlockInfo,
				text: extractTextFromRichText(block.heading_1.rich_text),
				color: block.heading_1.color,
				is_toggleable: block.heading_1.is_toggleable,
			}

		case "heading_2":
			return {
				...fullBlockInfo,
				text: extractTextFromRichText(block.heading_2.rich_text),
				color: block.heading_2.color,
				is_toggleable: block.heading_2.is_toggleable,
			}

		case "heading_3":
			return {
				...fullBlockInfo,
				text: extractTextFromRichText(block.heading_3.rich_text),
				color: block.heading_3.color,
				is_toggleable: block.heading_3.is_toggleable,
			}

		case "bulleted_list_item":
			return {
				...fullBlockInfo,
				text: extractTextFromRichText(block.bulleted_list_item.rich_text),
				color: block.bulleted_list_item.color,
			}

		case "numbered_list_item":
			return {
				...fullBlockInfo,
				text: extractTextFromRichText(block.numbered_list_item.rich_text),
				color: block.numbered_list_item.color,
			}

		case "to_do":
			return {
				...fullBlockInfo,
				text: extractTextFromRichText(block.to_do.rich_text),
				checked: block.to_do.checked,
				color: block.to_do.color,
			}

		case "toggle":
			return {
				...fullBlockInfo,
				text: extractTextFromRichText(block.toggle.rich_text),
				color: block.toggle.color,
			}

		case "quote":
			return {
				...fullBlockInfo,
				text: extractTextFromRichText(block.quote.rich_text),
				color: block.quote.color,
			}

		case "callout":
			return {
				...fullBlockInfo,
				text: extractTextFromRichText(block.callout.rich_text),
				icon: block.callout.icon,
				color: block.callout.color,
			}

		case "code":
			return {
				...fullBlockInfo,
				text: extractTextFromRichText(block.code.rich_text),
				language: block.code.language,
				caption: extractTextFromRichText(block.code.caption),
			}

		case "equation":
			return {
				...fullBlockInfo,
				expression: block.equation.expression,
			}

		case "divider":
			return fullBlockInfo

		case "table_of_contents":
			return {
				...fullBlockInfo,
				color: block.table_of_contents.color,
			}

		case "breadcrumb":
			return fullBlockInfo

		case "child_page":
			return {
				...fullBlockInfo,
				title: block.child_page.title,
			}

		case "child_database":
			return {
				...fullBlockInfo,
				title: block.child_database.title,
			}

		case "embed":
			return {
				...fullBlockInfo,
				url: block.embed.url,
				caption: extractTextFromRichText(block.embed.caption),
			}

		case "image": {
			const imageData =
				block.image.type === "external"
					? { url: block.image.external.url }
					: block.image.type === "file"
						? {
								url: block.image.file.url,
								expiry_time: block.image.file.expiry_time,
							}
						: {}
			return {
				...fullBlockInfo,
				type: block.image.type,
				...imageData,
				caption: extractTextFromRichText(block.image.caption),
			}
		}

		case "video": {
			const videoData =
				block.video.type === "external"
					? { url: block.video.external.url }
					: block.video.type === "file"
						? {
								url: block.video.file.url,
								expiry_time: block.video.file.expiry_time,
							}
						: {}
			return {
				...fullBlockInfo,
				type: block.video.type,
				...videoData,
				caption: extractTextFromRichText(block.video.caption),
			}
		}

		case "file": {
			const fileData =
				block.file.type === "external"
					? { url: block.file.external.url }
					: block.file.type === "file"
						? {
								url: block.file.file.url,
								expiry_time: block.file.file.expiry_time,
							}
						: {}
			return {
				...fullBlockInfo,
				type: block.file.type,
				name: block.file.name,
				...fileData,
				caption: extractTextFromRichText(block.file.caption),
			}
		}

		case "pdf": {
			const pdfData =
				block.pdf.type === "external"
					? { url: block.pdf.external.url }
					: block.pdf.type === "file"
						? {
								url: block.pdf.file.url,
								expiry_time: block.pdf.file.expiry_time,
							}
						: {}
			return {
				...fullBlockInfo,
				type: block.pdf.type,
				...pdfData,
				caption: extractTextFromRichText(block.pdf.caption),
			}
		}

		case "bookmark":
			return {
				...fullBlockInfo,
				url: block.bookmark.url,
				caption: extractTextFromRichText(block.bookmark.caption),
			}

		case "link_preview":
			return {
				...fullBlockInfo,
				url: block.link_preview.url,
			}

		case "table":
			return {
				...fullBlockInfo,
				table_width: block.table.table_width,
				has_column_header: block.table.has_column_header,
				has_row_header: block.table.has_row_header,
			}

		case "table_row":
			return {
				...fullBlockInfo,
				cells: block.table_row.cells.map(cell => extractTextFromRichText(cell)),
			}

		case "column_list":
			return fullBlockInfo

		case "column":
			return fullBlockInfo

		case "link_to_page":
			return {
				...fullBlockInfo,
				link_type: block.link_to_page.type,
				...(block.link_to_page.type === "page_id" && {
					page_id: block.link_to_page.page_id,
				}),
				...(block.link_to_page.type === "database_id" && {
					database_id: block.link_to_page.database_id,
				}),
			}

		case "synced_block":
			return {
				...fullBlockInfo,
				synced_from: block.synced_block.synced_from,
			}

		case "template":
			return {
				...fullBlockInfo,
				text: extractTextFromRichText(block.template.rich_text),
			}

		case "unsupported":
			return {
				...fullBlockInfo,
				unsupported: true,
			}

		default:
			// This should never be reached if all cases are handled
			return fullBlockInfo
	}
}

export function registerBlockTools(server: McpServer, notion: Client) {
	// Tool: Get Block
	server.tool(
		"get-block",
		"Retrieve a specific block by its ID. In Notion, everything is a block - pages are special blocks that contain other blocks (paragraphs, headings, lists, etc.). Use this to get a specific block's content. Note: If a block has 'has_children: true' (like toggleable headings), you must call get-block-children separately to fetch its nested content.",
		{
			blockId: z.string().describe("ID of the block to retrieve"),
		},
		async ({ blockId }) => {
			try {
				const cleanBlockId = cleanNotionId(blockId)
				const response = await notion.blocks.retrieve({
					block_id: cleanBlockId,
				})
				const blockContent = extractBlockContent(response)

				return formatToolResponse(blockContent)
			} catch (error: unknown) {
				return formatToolResponse(null, getErrorMessage(error))
			}
		},
	)

	// Tool: Get Block Children
	server.tool(
		"get-block-children",
		"Retrieve all child blocks within a page or block. In Notion, everything is a block - pages are special blocks that contain other blocks (paragraphs, headings, lists, etc.). Use this to: 1) Get all content within a page by passing the page ID, 2) Get nested content within any block that has 'has_children: true' (including toggleable headings, toggle blocks, etc.). IMPORTANT: Toggleable/collapsible content requires this separate call to fetch.",
		{
			blockId: z
				.string()
				.describe(
					"The page ID or parent block ID. Pass a page ID to get all blocks (content) within that page, or a block ID to get nested content (e.g., content under a toggleable heading).",
				),
			startCursor: z.string().optional().describe("Cursor for pagination"),
			pageSize: z
				.number()
				.optional()
				.default(100)
				.describe("Number of results per page"),
		},
		async ({ blockId, startCursor, pageSize }) => {
			try {
				const cleanBlockId = cleanNotionId(blockId)
				const params = {
					block_id: cleanBlockId,
					page_size: pageSize,
					...(startCursor && { start_cursor: startCursor }),
				}

				const response = await notion.blocks.children.list(params)

				// Extract content from child blocks
				const children = response.results.map(block =>
					extractBlockContent(block),
				)

				const result = {
					blocks: children,
					has_more: response.has_more,
					next_cursor: response.next_cursor,
				}

				return formatToolResponse(result)
			} catch (error: unknown) {
				return formatToolResponse(null, getErrorMessage(error))
			}
		},
	)

	// Tool: Append Block Children
	server.tool(
		"append-block-children",
		"Append new children blocks to a parent block",
		{
			blockId: z.string().describe("ID of the parent block"),
			children: z
				.array(z.record(z.unknown()))
				.describe("Array of block objects to append"),
			after: z
				.string()
				.optional()
				.describe("ID of the block after which to append"),
		},
		async ({ blockId, children, after }) => {
			try {
				const cleanBlockId = cleanNotionId(blockId)
				const response = await notion.blocks.children.append({
					block_id: cleanBlockId,
					children: children as BlockObjectRequest[],
					...(after && { after }),
				})

				const result = {
					blocks: response.results,
					has_more: response.has_more,
					next_cursor: response.next_cursor,
				}

				return formatToolResponse(result)
			} catch (error: unknown) {
				return formatToolResponse(null, getErrorMessage(error))
			}
		},
	)

	// Tool: Update Block
	server.tool(
		"update-block",
		"Update an existing block",
		{
			blockId: z.string().describe("ID of the block to update"),
			blockType: z.string().describe("Type of block to update"),
			content: z.record(z.unknown()).describe("New content for the block"),
			archived: z.boolean().optional().describe("Archive status"),
		},
		async ({ blockId, blockType, content, archived }) => {
			try {
				const cleanBlockId = cleanNotionId(blockId)
				const updateData: Record<string, unknown> = {}

				// We need to extract the inner content for the block type
				if (content[blockType]) {
					updateData[blockType] = content[blockType]
				} else {
					// Fallback: treat content as the direct block content
					updateData[blockType] = content
				}

				if (archived !== undefined) {
					updateData.archived = archived
				}

				const response = await notion.blocks.update({
					block_id: cleanBlockId,
					...updateData,
				})

				if (!isFullBlock(response)) {
					throw new Error("Failed to update block")
				}

				const result = {
					id: response.id,
					type: response.type,
					last_edited_time: response.last_edited_time,
				}

				return formatToolResponse(result)
			} catch (error: unknown) {
				return formatToolResponse(null, getErrorMessage(error))
			}
		},
	)
}
