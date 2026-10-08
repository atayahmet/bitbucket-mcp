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
          description:
            "List pull requests in a repository: a summary of each (id, title, description, state, author, branches, dates, comment and task counts). get_pull_request has the rest.",
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
              limit: {
                type: "number",
                default: 20,
                description:
                  "Maximum number of pull requests to return, most recently updated first",
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
          description:
            "Get the raw diff of a pull request: the changes it makes (its source against the merge base with the destination)",
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
          name: "list_pull_request_commits",
          description: "List the commits of a pull request",
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
          name: "get_pull_request_activity",
          description:
            "Get a pull request's timeline: updates (new commits, title, description or reviewer changes), approvals, change requests and comments. Use it to see what changed since a review.",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number", description: "Pull request ID" },
              limit: {
                type: "number",
                default: 20,
                description: "Maximum number of entries to return, newest first",
              },
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
                description:
                  "Line number for inline comment (optional). With inline_start_line, the last line of the range.",
              },
              inline_start_line: {
                type: "number",
                description:
                  "First line of a multi-line inline comment (optional); the range ends at inline_line",
              },
              inline_side: {
                type: "string",
                enum: ["new", "old"],
                default: "new",
                description:
                  'Which file the line numbers count in: "new" (added or unchanged lines) or "old" (to comment on a deleted line)',
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
          name: "update_pull_request_comment",
          description:
            "Edit the text of a pull request comment (only its author can)",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number" },
              comment_id: { type: "number" },
              body: {
                type: "string",
                description: "New comment text (Markdown supported)",
              },
            },
            required: ["workspace", "repo_slug", "pr_id", "comment_id", "body"],
          },
        },
        {
          name: "delete_pull_request_comment",
          description: "Delete a pull request comment",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number" },
              comment_id: { type: "number" },
            },
            required: ["workspace", "repo_slug", "pr_id", "comment_id"],
          },
        },
        {
          name: "list_pull_request_tasks",
          description:
            "List the tasks on a pull request, with their state (RESOLVED/UNRESOLVED) and the comment each is attached to",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number" },
            },
            required: ["workspace", "repo_slug", "pr_id"],
          },
        },
        {
          name: "create_pull_request_task",
          description:
            "Create a task on a pull request, attached to a comment (comment_id) or to the pull request alone",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number" },
              content: { type: "string", description: "Task text" },
              comment_id: {
                type: "number",
                description: "ID of the comment to attach the task to (optional)",
              },
            },
            required: ["workspace", "repo_slug", "pr_id", "content"],
          },
        },
        {
          name: "update_pull_request_task",
          description:
            "Edit a pull request task's text, or resolve or reopen it (state)",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number" },
              task_id: { type: "number" },
              content: { type: "string", description: "New task text" },
              state: {
                type: "string",
                enum: ["RESOLVED", "UNRESOLVED"],
                description: "RESOLVED to complete the task, UNRESOLVED to reopen it",
              },
            },
            required: ["workspace", "repo_slug", "pr_id", "task_id"],
          },
        },
        {
          name: "delete_pull_request_task",
          description: "Delete a pull request task",
          inputSchema: {
            type: "object",
            properties: {
              workspace: { type: "string" },
              repo_slug: { type: "string" },
              pr_id: { type: "number" },
              task_id: { type: "number" },
            },
            required: ["workspace", "repo_slug", "pr_id", "task_id"],
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
          name: "request_changes_on_pull_request",
          description: "Request changes on a pull request",
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
          name: "remove_request_changes_on_pull_request",
          description: "Withdraw your change request on a pull request",
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
                      args?.limit as number | undefined,
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
          case "list_pull_request_commits":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.listPullRequestCommits(
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
          case "get_pull_request_activity":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.getPullRequestActivity(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.pr_id as number,
                      args?.limit as number | undefined,
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
                  start_line: args.inline_start_line as number | undefined,
                  side: args.inline_side as "new" | "old" | undefined,
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
          case "update_pull_request_comment":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.updatePullRequestComment(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.pr_id as number,
                      args?.comment_id as number,
                      args?.body as string,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "delete_pull_request_comment":
            await this.bitbucket.deletePullRequestComment(
              args?.workspace as string,
              args?.repo_slug as string,
              args?.pr_id as number,
              args?.comment_id as number,
            );
            return {
              content: [{ type: "text", text: "Comment deleted successfully." }],
            };
          case "list_pull_request_tasks":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.listPullRequestTasks(
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
          case "create_pull_request_task":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.createPullRequestTask(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.pr_id as number,
                      args?.content as string,
                      args?.comment_id as number | undefined,
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "update_pull_request_task":
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    await this.bitbucket.updatePullRequestTask(
                      args?.workspace as string,
                      args?.repo_slug as string,
                      args?.pr_id as number,
                      args?.task_id as number,
                      {
                        content: args?.content as string | undefined,
                        state: args?.state as
                          | "RESOLVED"
                          | "UNRESOLVED"
                          | undefined,
                      },
                    ),
                    null,
                    2,
                  ),
                },
              ],
            };
          case "delete_pull_request_task":
            await this.bitbucket.deletePullRequestTask(
              args?.workspace as string,
              args?.repo_slug as string,
              args?.pr_id as number,
              args?.task_id as number,
            );
            return {
              content: [{ type: "text", text: "Task deleted successfully." }],
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
          case "request_changes_on_pull_request":
            await this.bitbucket.requestChangesOnPullRequest(
              args?.workspace as string,
              args?.repo_slug as string,
              args?.pr_id as number,
            );
            return {
              content: [
                { type: "text", text: "Changes requested on the pull request." },
              ],
            };
          case "remove_request_changes_on_pull_request":
            await this.bitbucket.removeRequestChangesOnPullRequest(
              args?.workspace as string,
              args?.repo_slug as string,
              args?.pr_id as number,
            );
            return {
              content: [
                { type: "text", text: "Change request removed from the pull request." },
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
