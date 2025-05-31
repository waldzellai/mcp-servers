import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import type { Client } from "@notionhq/client"
import type {
	CommentObjectResponse,
	CreateCommentResponse,
} from "@notionhq/client/build/src/api-endpoints.js"
import { z } from "zod"
import {
	cleanNotionId,
	extractTextFromRichText,
	formatToolResponse,
	getErrorMessage,
} from "./utils.js"

function isFullComment(
	response: CreateCommentResponse,
): response is CommentObjectResponse {
	return response.object === "comment" && "created_time" in response
}

function extractTextFromComment(comment: CommentObjectResponse): string {
	return extractTextFromRichText(comment.rich_text) || "No content"
}

export function registerCommentTools(server: McpServer, notion: Client) {
	// Tool: Get Comments
	server.tool(
		"get-comments",
		"Retrieve comments on a specific Notion block or page. IMPORTANT: This only returns comments attached directly to the specified ID. It does NOT search child blocks. To find comments throughout a page, you need to: 1) Get the page's child blocks using get-block-children, 2) Call get-comments on each block that might have comments. Comments are returned as a flat list in chronological order.",
		{
			discussionId: z
				.string()
				.optional()
				.describe("Optional: Filter by specific discussion thread ID"),
			blockId: z
				.string()
				.describe(
					"The block ID or page ID to retrieve comments from. Note: Pages are blocks in Notion's API.",
				),
			startCursor: z.string().optional().describe("Pagination cursor"),
			pageSize: z
				.number()
				.min(1)
				.max(100)
				.optional()
				.default(10)
				.describe("Number of comments per page (max 100)"),
		},
		async ({ discussionId, blockId, startCursor, pageSize }) => {
			try {
				const params = {
					block_id: cleanNotionId(blockId),
					page_size: pageSize,
					...(discussionId && { discussion_id: discussionId }),
					...(startCursor && { start_cursor: startCursor }),
				}

				const response = await notion.comments.list(params)

				const formattedComments = response.results.map(
					(comment: CommentObjectResponse) => ({
						id: comment.id,
						created_time: comment.created_time,
						created_by:
							"name" in comment.created_by
								? comment.created_by.name
								: comment.created_by.id,
						discussion_id: comment.discussion_id,
						parent: comment.parent,
						content: extractTextFromComment(comment),
					}),
				)

				return formatToolResponse({
					comments: formattedComments,
					total: response.results.length,
				})
			} catch (error: unknown) {
				return formatToolResponse(null, getErrorMessage(error))
			}
		},
	)

	// Tool: Get All Page Comments
	server.tool(
		"get-all-page-comments",
		"Retrieve ALL comments from a Notion page by searching both the page itself and every block within the page. This is more comprehensive than get-comments as it finds comments attached to any block in the page.",
		{
			pageId: z.string().describe("The page ID to search for all comments"),
			pageSize: z
				.number()
				.min(1)
				.max(100)
				.optional()
				.default(10)
				.describe("Number of comments per page"),
		},
		async ({ pageId, pageSize }) => {
			try {
				const allComments: CommentObjectResponse[] = []

				// First, get comments on the page itself
				try {
					const pageComments = await notion.comments.list({
						block_id: pageId,
						page_size: pageSize || 10,
					})
					allComments.push(...pageComments.results)
				} catch (_error) {
					// Ignore errors for page-level comments if page doesn't support them
				}

				// Then, get all blocks in the page and check each for comments
				try {
					const blocksResponse = await notion.blocks.children.list({
						block_id: pageId,
						page_size: 100, // Get up to 100 blocks
					})

					// Check each block for comments
					for (const block of blocksResponse.results) {
						try {
							const blockComments = await notion.comments.list({
								block_id: block.id,
								page_size: pageSize || 10,
							})
							allComments.push(...blockComments.results)
						} catch (_error) {
							// Some blocks might not support comments, skip to next block
						}
					}
				} catch (_error) {
					// If we can't get blocks, just return page-level comments
				}

				// Format all comments
				const formattedComments = allComments.map(
					(comment: CommentObjectResponse) => ({
						id: comment.id,
						created_time: comment.created_time,
						created_by:
							"name" in comment.created_by
								? comment.created_by.name
								: comment.created_by.id,
						discussion_id: comment.discussion_id,
						parent: comment.parent,
						content: extractTextFromComment(comment),
					}),
				)

				// Sort by creation time
				formattedComments.sort(
					(a, b) =>
						new Date(a.created_time).getTime() -
						new Date(b.created_time).getTime(),
				)

				return formatToolResponse({
					comments: formattedComments,
					total: formattedComments.length,
				})
			} catch (error) {
				return formatToolResponse(null, getErrorMessage(error))
			}
		},
	)

	// Tool: Create Comment
	server.tool(
		"create-comment",
		"Create a new comment on a Notion page or specific block. Comments can be attached to: 1) An entire page (use page ID), or 2) A specific block within a page (use block ID). To reply to an existing comment thread, use the discussionId.",
		{
			parentId: z
				.string()
				.describe(
					"The page ID or block ID to attach the comment to. Use page ID to comment on the entire page, or block ID to comment on a specific paragraph/heading/etc. Required if discussionId is not provided.",
				),
			discussionId: z
				.string()
				.optional()
				.describe(
					"Optional: Reply to an existing comment thread by providing its discussion ID",
				),
			content: z.string().describe("The text content of your comment"),
		},
		async ({ parentId, content, discussionId }) => {
			try {
				const richText = [
					{
						type: "text" as const,
						text: {
							content,
						},
					},
				]

				const createParams = discussionId
					? {
							discussion_id: discussionId,
							rich_text: richText,
						}
					: parentId
						? ({
								parent:
									cleanNotionId(parentId).length === 32
										? {
												type: "page_id" as const,
												page_id: cleanNotionId(parentId),
											}
										: {
												type: "block_id" as const,
												block_id: cleanNotionId(parentId),
											},
								rich_text: richText,
							} as Parameters<typeof notion.comments.create>[0])
						: (() => {
								throw new Error(
									"Either parentId or discussionId must be provided",
								)
							})()

				const response = await notion.comments.create(createParams)

				// Check if we got a full response
				if (!isFullComment(response)) {
					throw new Error(
						"Failed to create comment - received partial response",
					)
				}

				const result = {
					id: response.id,
					discussionId: response.discussion_id,
					content: extractTextFromComment(response),
					createdTime: response.created_time,
					createdBy: response.created_by?.id || "unknown",
					parentType: "parent" in response ? response.parent.type : undefined,
					parentId:
						"parent" in response
							? response.parent.type === "page_id"
								? response.parent.page_id
								: response.parent.block_id
							: undefined,
				}

				return formatToolResponse(result)
			} catch (error: unknown) {
				return formatToolResponse(null, getErrorMessage(error))
			}
		},
	)
}
