#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { BitbucketClient } from "./bitbucket-api.js";

class BitbucketServer {
  private server: Server;
  private bitbucket: BitbucketClient;

  constructor() {
    const email = process.env.BITBUCKET_EMAIL;
    const token = process.env.BITBUCKET_TOKEN;

    if (!email || !token) {
      throw new Error(
        "BITBUCKET_EMAIL and BITBUCKET_TOKEN environment variables are required. Please set them in your MCP settings/configuration.",
      );
    }

    this.bitbucket = new BitbucketClient(email, token);
    this.server = new Server(
      {
        name: "bitbucket-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    this.setupToolHandlers();

    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "list_repositories",
          description: "List repositories in a workspace",
          inputSchema: {
            type: "object",
            properties: {
              workspace: {
                type: "string",
                description: "Bitbucket workspace ID",
              },
            },
            required: ["workspace"],
          },
        },
        {
          name: "get_repository",
          description: "Get details of a specific repository",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
            },
            required: ["workspace", "repo_slug"],
          },
        },
        {
          name: "list_directory",
          description: "List contents of a directory in a repository",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              path: { type: "string", default: "" },
              branch: { type: "string", default: "main" },
            },
            required: ["workspace", "repo_slug"],
          },
        },
        {
          name: "get_file_content",
          description: "Read the content of a file",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              path: { type: "string" },
              branch: { type: "string", default: "main" },
            },
            required: ["workspace", "repo_slug", "path"],
          },
        },
        {
          name: "create_pull_request",
          description: "Create a new pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              title: { type: "string", description: "PR title" },
              source_branch: {
                type: "string",
                description: "Source branch name",
              },
              destination_branch: {
                type: "string",
                description:
                  "Destination branch name (optional, defaults to repo main branch)",
              },
              description: {
                type: "string",
                description: "PR description (optional)",
              },
              close_source_branch: {
                type: "boolean",
                default: true,
                description: "Whether to close source branch after merging",
              },
            },
            required: ["workspace", "repo_slug", "title", "source_branch"],
          },
        },
        {
          name: "update_pull_request",
          description:
            "Update pull request details (title, description, reviewers, destination branch)",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number" },
              title: { type: "string", description: "Updated title" },
              description: {
                type: "string",
                description: "Updated description",
              },
              destination_branch: {
                type: "string",
                description: "Updated destination branch name",
              },
              reviewers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    uuid: { type: "string", description: "Reviewer UUID" },
                    account_id: {
                      type: "string",
                      description: "Reviewer account ID",
                    },
                  },
                },
                description:
                  "Full list of reviewers (overwrites existing list)",
              },
            },
            required: ["workspace", "repo_slug", "pr_id"],
          },
        },
        {
          name: "list_pull_requests",
          description: "List pull requests in a repository",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              state: {
                type: "string",
                enum: ["OPEN", "MERGED", "DECLINED", "SUPERSEDED"],
                default: "OPEN",
              },
            },
            required: ["workspace", "repo_slug"],
          },
        },
        {
          name: "list_commits",
          description: "List commits in a branch",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              branch: { type: "string", default: "main" },
            },
            required: ["workspace", "repo_slug"],
          },
        },
        {
          name: "get_pull_request",
          description: "Get details of a specific pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number", description: "Pull request ID" },
            },
            required: ["workspace", "repo_slug", "pr_id"],
          },
        },
        {
          name: "get_pull_request_diff",
          description: "Get the raw diff of a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number", description: "Pull request ID" },
            },
            required: ["workspace", "repo_slug", "pr_id"],
          },
        },
        {
          name: "get_pull_request_diffstat",
          description: "Get diffstat (changed files summary) of a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number", description: "Pull request ID" },
            },
            required: ["workspace", "repo_slug", "pr_id"],
          },
        },
        {
          name: "list_pull_request_comments",
          description: "List all comments on a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number", description: "Pull request ID" },
            },
            required: ["workspace", "repo_slug", "pr_id"],
          },
        },
        {
          name: "add_pull_request_comment",
          description:
            "Add a comment to a pull request. Can be a general comment, an inline comment on a specific file/line, or a reply to an existing comment (parent_id).",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number", description: "Pull request ID" },
              body: {
                type: "string",
                description: "Comment text (Markdown supported)",
              },
              inline_path: {
                type: "string",
                description: "File path for inline comment (optional)",
              },
              inline_line: {
                type: "number",
                description: "Line number for inline comment (optional)",
              },
              parent_id: {
                type: "number",
                description:
                  "ID of the comment to reply to (optional). The reply is threaded under it.",
              },
            },
            required: ["workspace", "repo_slug", "pr_id", "body"],
          },
        },
        {
          name: "resolve_pull_request_comment",
          description:
            "Resolve a pull request comment thread (resolved: true, default) or reopen it (resolved: false)",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number" },
              comment_id: { type: "number" },
              resolved: { type: "boolean", default: true },
            },
            required: ["workspace", "repo_slug", "pr_id", "comment_id"],
          },
        },
        {
          name: "react_to_pull_request_comment",
          description: "Add a reaction (e.g. thumbsup) to a pull request comment",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number" },
              comment_id: { type: "number" },
              reaction: { type: "string", default: "thumbsup" },
            },
            required: ["workspace", "repo_slug", "pr_id", "comment_id"],
          },
        },
        {
          name: "remove_reaction_from_pull_request_comment",
          description: "Remove a reaction from a pull request comment",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number" },
              comment_id: { type: "number" },
              reaction: { type: "string", default: "thumbsup" },
            },
            required: ["workspace", "repo_slug", "pr_id", "comment_id"],
          },
        },
        {
          name: "approve_pull_request",
          description: "Approve a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number", description: "Pull request ID" },
            },
            required: ["workspace", "repo_slug", "pr_id"],
          },
        },
        {
          name: "unapprove_pull_request",
          description: "Remove approval from a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number", description: "Pull request ID" },
            },
            required: ["workspace", "repo_slug", "pr_id"],
          },
        },
        {
          name: "merge_pull_request",
          description: "Merge a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number", description: "Pull request ID" },
              merge_strategy: {
                type: "string",
                enum: ["merge_commit", "squash", "fast_forward"],
                default: "merge_commit",
              },
              close_source_branch: { type: "boolean", default: true },
            },
            required: ["workspace", "repo_slug", "pr_id"],
          },
        },
        {
          name: "decline_pull_request",
          description: "Decline a pull request",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number", description: "Pull request ID" },
            },
            required: ["workspace", "repo_slug", "pr_id"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        switch (name) {
          case "list_repositories":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.listRepositories(
                      args?.workspace as string,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "get_repository":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.getRepository(
                      args?.workspace as string,
                      args?.repo_slug as string,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "list_directory":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.listDirectory(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.path as string,
                      args?.branch as string,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "get_file_content":
            return {
              content: [
                {
                  type: "text",
                  text: await this.bitbucket.getFileContent(
                    args?.workspace as string,
                    args?.repo_slug as string,
                    args?.path as string,
                    args?.branch as string,
                  ),
                },
              ],
            };
          case "create_pull_request":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.createPullRequest(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.title as string,
                      args?.source_branch as string,
                      args?.destination_branch as string | undefined,
                      args?.description as string | undefined,
                      args?.close_source_branch as boolean,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "update_pull_request":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.updatePullRequest(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.pr_id as number,
                      {
                        title: args?.title as string | undefined,
                        description: args?.description as string | undefined,
                        reviewers: args?.reviewers as any[] | undefined,
                        destination_branch: args?.destination_branch as
                          | string
                          | undefined,
                      },
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "list_pull_requests":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.listPullRequests(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.state as any,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "list_commits":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.listCommits(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.branch as string,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "get_pull_request":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.getPullRequest(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.pr_id as number,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "get_pull_request_diff":
            return {
              content: [
                {
                  type: "text",
                  text: await this.bitbucket.getPullRequestDiff(
                    args?.workspace as string,
                    args?.repo_slug as string,
                    args?.pr_id as number,
                  ),
                },
              ],
            };
          case "get_pull_request_diffstat":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.getPullRequestDiffstat(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.pr_id as number,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "list_pull_request_comments":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.listPullRequestComments(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.pr_id as number,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "add_pull_request_comment": {
            const inline = args?.inline_path
              ? {
                  path: args.inline_path as string,
                  line: args.inline_line as number,
                }
              : undefined;
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.addPullRequestComment(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.pr_id as number,
                      args?.body as string,
                      inline,
                      args?.parent_id as number | undefined,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          }
          case "resolve_pull_request_comment":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.resolvePullRequestComment(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.pr_id as number,
                      args?.comment_id as number,
                      args?.resolved as boolean,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "react_to_pull_request_comment":
            await this.bitbucket.reactToPullRequestComment(
              args?.workspace as string,
              args?.repo_slug as string,
              args?.pr_id as number,
              args?.comment_id as number,
              args?.reaction as string,
            );
            return {
              content: [
                { type: "text", text: "Reaction added successfully." },
              ],
            };
          case "remove_reaction_from_pull_request_comment":
            await this.bitbucket.removeReactionFromPullRequestComment(
              args?.workspace as string,
              args?.repo_slug as string,
              args?.pr_id as number,
              args?.comment_id as number,
              args?.reaction as string,
            );
            return {
              content: [
                { type: "text", text: "Reaction removed successfully." },
              ],
            };
          case "approve_pull_request":
            await this.bitbucket.approvePullRequest(
              args?.workspace as string,
              args?.repo_slug as string,
              args?.pr_id as number,
            );
            return {
              content: [
                { type: "text", text: "Pull request approved successfully." },
              ],
            };
          case "unapprove_pull_request":
            await this.bitbucket.unapprovePullRequest(
              args?.workspace as string,
              args?.repo_slug as string,
              args?.pr_id as number,
            );
            return {
              content: [
                { type: "text", text: "Pull request approval removed." },
              ],
            };
          case "merge_pull_request":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.mergePullRequest(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.pr_id as number,
                      args?.merge_strategy as any,
                      args?.close_source_branch as boolean,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "decline_pull_request":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.declinePullRequest(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.pr_id as number,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`,
            );
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Bitbucket MCP server running on stdio");
  }
}

const server = new BitbucketServer();
server.run().catch(console.error);
