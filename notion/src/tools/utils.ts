import type {
	PageObjectResponse,
	RichTextItemResponse,
	TextRichTextItemResponse,
} from "@notionhq/client/build/src/api-endpoints.js"

// Common response formatting
export function formatToolResponse(
	data: Record<string, unknown> | null,
	error?: string,
) {
	if (error) {
		return {
			content: [
				{
					type: "text" as const,
					text: `Error: ${error}`,
				},
			],
			isError: true,
		}
	}

	return {
		content: [
			{
				type: "text" as const,
				text: JSON.stringify(data, null, 2),
			},
		],
		structuredContent: data || undefined,
	}
}

// Error message extraction
export function getErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error)
}

// Type guard for rich text items with plain_text
export function hasPlainText(
	item: RichTextItemResponse,
): item is TextRichTextItemResponse {
	return "plain_text" in item
}

// Extract text from rich text array
export function extractTextFromRichText(
	richTextArray: RichTextItemResponse[] | undefined,
): string {
	if (!richTextArray || !Array.isArray(richTextArray)) return ""
	return richTextArray
		.filter(hasPlainText)
		.map(item => item.plain_text)
		.join("")
}

// Extract page properties (used in both pages.ts and databases.ts)
export function extractPageProperties(
	page: PageObjectResponse,
): Record<string, unknown> {
	const properties: Record<string, unknown> = {}

	for (const [key, prop] of Object.entries(page.properties)) {
		switch (prop.type) {
			case "title":
				properties[key] = prop.title[0]?.plain_text || ""
				break
			case "rich_text":
				properties[key] = prop.rich_text[0]?.plain_text || ""
				break
			case "number":
				properties[key] = prop.number
				break
			case "select":
				properties[key] = prop.select?.name
				break
			case "multi_select":
				properties[key] = prop.multi_select?.map(s => s.name) || []
				break
			case "date":
				properties[key] = prop.date?.start
				break
			case "checkbox":
				properties[key] = prop.checkbox
				break
			case "url":
				properties[key] = prop.url
				break
			case "email":
				properties[key] = prop.email
				break
			case "phone_number":
				properties[key] = prop.phone_number
				break
			case "created_time":
				properties[key] = prop.created_time
				break
			case "created_by":
				properties[key] = prop.created_by.id
				break
			case "last_edited_time":
				properties[key] = prop.last_edited_time
				break
			case "last_edited_by":
				properties[key] = prop.last_edited_by.id
				break
			default:
				// For any other property types, store the property object as-is
				properties[key] = prop
		}
	}

	return properties
}

// Clean ID by removing hyphens (Notion IDs can be used with or without hyphens)
export function cleanNotionId(id: string): string {
	return id.replace(/-/g, "")
}
