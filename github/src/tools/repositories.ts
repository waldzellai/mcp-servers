import { z } from "zod"
import { Octokit } from "octokit"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

export function registerRepositoryTools(server: McpServer, octokit: Octokit) {
  // Tool: Get Commit
  server.tool(
    "get_commit",
    "Get details for a commit from a GitHub repository",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      sha: z.string().describe("Commit SHA, branch name, or tag name"),
    },
    async ({ owner, repo, sha }) => {
      try {
        const response = await octokit.rest.repos.getCommit({
          owner,
          repo,
          ref: sha,
        })
        return {
          content: [{ type: "text", text: JSON.stringify(response.data) }],
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
        }
      }
    }
  )

  // Tool: List Commits
  server.tool(
    "list_commits",
    "Get list of commits of a branch in a GitHub repository",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      sha: z.string().optional().describe("SHA or Branch name"),
      per_page: z.number().optional().default(30).describe("Results per page (default 30, max 100)"),
      page: z.number().optional().default(1).describe("Page number (default 1)"),
    },
    async ({ owner, repo, sha, per_page, page }) => {
      try {
        const response = await octokit.rest.repos.listCommits({
          owner,
          repo,
          sha,
          per_page,
          page,
        })
        return {
          content: [{ type: "text", text: JSON.stringify(response.data) }],
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
        }
      }
    }
  )

  // Tool: List Branches
  server.tool(
    "list_branches",
    "List branches in a GitHub repository",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      per_page: z.number().optional().default(30).describe("Results per page (default 30, max 100)"),
      page: z.number().optional().default(1).describe("Page number (default 1)"),
    },
    async ({ owner, repo, per_page, page }) => {
      try {
        const response = await octokit.rest.repos.listBranches({
          owner,
          repo,
          per_page,
          page,
        })
        return {
          content: [{ type: "text", text: JSON.stringify(response.data) }],
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
        }
      }
    }
  )

  // Tool: Create or Update File
  server.tool(
    "create_or_update_file",
    "Create or update a single file in a GitHub repository. If updating, you must provide the SHA of the file you want to update.",
    {
      owner: z.string().describe("Repository owner (username or organization)"),
      repo: z.string().describe("Repository name"),
      path: z.string().describe("Path where to create/update the file"),
      content: z.string().describe("Content of the file (will be base64-encoded)"),
      message: z.string().describe("Commit message"),
      branch: z.string().describe("Branch to create/update the file in"),
      sha: z.string().optional().describe("SHA of file being replaced (for updates)"),
    },
    async ({ owner, repo, path, content, message, branch, sha }) => {
      try {
        const response = await octokit.rest.repos.createOrUpdateFileContents({
          owner,
          repo,
          path,
          message,
          content: Buffer.from(content).toString('base64'),
          branch,
          sha,
        })
        return {
          content: [{ type: "text", text: JSON.stringify(response.data) }],
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
        }
      }
    }
  )

  // Tool: Create Repository
  server.tool(
    "create_repository",
    "Create a new GitHub repository in your account",
    {
      name: z.string().describe("Repository name"),
      description: z.string().optional().describe("Repository description"),
      private: z.boolean().optional().describe("Whether repo should be private"),
      autoInit: z.boolean().optional().describe("Initialize with README"),
    },
    async ({ name, description, private: isPrivate, autoInit }) => {
      try {
        const response = await octokit.rest.repos.createForAuthenticatedUser({
          name,
          description,
          private: isPrivate,
          auto_init: autoInit,
        })
        return {
          content: [{ type: "text", text: JSON.stringify(response.data) }],
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
        }
      }
    }
  )

  // Tool: Get File Contents
  server.tool(
    "get_file_contents",
    "Get the contents of a file or directory from a GitHub repository",
    {
      owner: z.string().describe("Repository owner (username or organization)"),
      repo: z.string().describe("Repository name"),
      path: z.string().describe("Path to file/directory"),
      branch: z.string().optional().describe("Branch to get contents from"),
    },
    async ({ owner, repo, path, branch }) => {
      try {
        const response = await octokit.rest.repos.getContent({
          owner,
          repo,
          path,
          ref: branch,
        })
        
        // If it's a file, decode the content
        if (!Array.isArray(response.data) && response.data.type === 'file') {
          const content = Buffer.from(response.data.content, 'base64').toString('utf-8')
          response.data.content = content
        }
        
        return {
          content: [{ type: "text", text: JSON.stringify(response.data) }],
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
        }
      }
    }
  )

  // Tool: Fork Repository
  server.tool(
    "fork_repository",
    "Fork a GitHub repository to your account or specified organization",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      organization: z.string().optional().describe("Organization to fork to"),
    },
    async ({ owner, repo, organization }) => {
      try {
        const response = await octokit.rest.repos.createFork({
          owner,
          repo,
          organization,
        })
        return {
          content: [{ type: "text", text: JSON.stringify(response.data) }],
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
        }
      }
    }
  )

  // Tool: Create Branch
  server.tool(
    "create_branch",
    "Create a new branch in a GitHub repository",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      branch: z.string().describe("Name for new branch"),
      from_branch: z.string().optional().describe("Source branch (defaults to repo default)"),
    },
    async ({ owner, repo, branch, from_branch }) => {
      try {
        // Get the source branch ref
        let sourceBranch = from_branch
        if (!sourceBranch) {
          const repoResp = await octokit.rest.repos.get({ owner, repo })
          sourceBranch = repoResp.data.default_branch
        }
        const refResp = await octokit.rest.git.getRef({
          owner,
          repo,
          ref: `heads/${sourceBranch}`,
        })
        const sha = refResp.data.object.sha
        // Create new branch
        const response = await octokit.rest.git.createRef({
          owner,
          repo,
          ref: `refs/heads/${branch}`,
          sha,
        })
        return {
          content: [{ type: "text", text: JSON.stringify(response.data) }],
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
        }
      }
    }
  )

  // Tool: List Tags
  server.tool(
    "list_tags",
    "List git tags in a GitHub repository",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      per_page: z.number().optional().default(30).describe("Results per page (default 30, max 100)"),
      page: z.number().optional().default(1).describe("Page number (default 1)"),
    },
    async ({ owner, repo, per_page, page }) => {
      try {
        const response = await octokit.rest.repos.listTags({
          owner,
          repo,
          per_page,
          page,
        })
        return {
          content: [{ type: "text", text: JSON.stringify(response.data) }],
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
        }
      }
    }
  )

  // Tool: Get Tag
  server.tool(
    "get_tag",
    "Get details about a specific git tag in a GitHub repository",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      tag: z.string().describe("Tag name"),
    },
    async ({ owner, repo, tag }) => {
      try {
        // Get the tag reference
        const refResp = await octokit.rest.git.getRef({
          owner,
          repo,
          ref: `tags/${tag}`,
        })
        const sha = refResp.data.object.sha
        // Get the tag object
        const tagResp = await octokit.rest.git.getTag({
          owner,
          repo,
          tag_sha: sha,
        })
        return {
          content: [{ type: "text", text: JSON.stringify(tagResp.data) }],
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
        }
      }
    }
  )

  // Tool: Push Files
  server.tool(
    "push_files",
    "Push multiple files to a GitHub repository in a single commit",
    {
      owner: z.string().describe("Repository owner"),
      repo: z.string().describe("Repository name"),
      branch: z.string().describe("Branch to push to"),
      files: z.array(z.object({ path: z.string(), content: z.string() })).describe("Array of file objects to push, each object with path (string) and content (string)"),
      message: z.string().describe("Commit message"),
    },
    async ({ owner, repo, branch, files, message }) => {
      try {
        // Get the reference for the branch
        const refResp = await octokit.rest.git.getRef({
          owner,
          repo,
          ref: `heads/${branch}`,
        })
        const baseSha = refResp.data.object.sha

        // Get the commit object that the branch points to
        const baseCommit = await octokit.rest.git.getCommit({
          owner,
          repo,
          commit_sha: baseSha,
        })

        // Create tree entries for all files
        const treeItems = files.map(file => ({
          path: file.path,
          mode: '100644' as const, // Regular file mode
          type: 'blob' as const,
          content: file.content,
        }))

        // Create a new tree with the file entries
        const newTree = await octokit.rest.git.createTree({
          owner,
          repo,
          base_tree: baseCommit.data.tree.sha,
          tree: treeItems,
        })

        // Create a new commit
        const newCommit = await octokit.rest.git.createCommit({
          owner,
          repo,
          message,
          tree: newTree.data.sha,
          parents: [baseSha],
        })

        // Update the reference to point to the new commit
        const updatedRef = await octokit.rest.git.updateRef({
          owner,
          repo,
          ref: `heads/${branch}`,
          sha: newCommit.data.sha,
          force: false,
        })

        return {
          content: [{ type: "text", text: JSON.stringify(updatedRef.data) }],
        }
      } catch (e: any) {
        return {
          content: [{ type: "text", text: `Error: ${e.message}` }],
        }
      }
    }
  )
} 