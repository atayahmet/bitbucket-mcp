# Bitbucket MCP Server

A Model Context Protocol (MCP) server that works with the Bitbucket REST API. Designed to communicate over `stdio` inside a Docker container.

## Setup

### 1. Build the Docker Image

```bash
docker build -t bitbucket-mcp .
```

### 2. Create a Bitbucket API Token

The MCP server uses a **Bitbucket App Password** for authentication. To create a token:

1. Log in to your Bitbucket account
2. Go to **Settings**: `https://bitbucket.org/account/settings/`
3. Click **App passwords** in the left menu (`https://bitbucket.org/account/settings/app-passwords/`)
4. Click the **Create app password** button
5. Enter a label (e.g. `bitbucket-mcp`)
6. Select the required permissions:
   - **Repositories**: Read
   - **Pull requests**: Read, Write
7. Click **Create** and copy the generated token

> **Note:** The token is only shown once. If you lose it, you will need to create a new one.

### 3. Configuration via MCP Settings

Credentials are passed through the `env` field in MCP settings. No separate `.env` file is needed.

#### Claude Desktop

`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "bitbucket-mcp"],
      "env": {
        "BITBUCKET_EMAIL": "your-email@example.com",
        "BITBUCKET_TOKEN": "your-bitbucket-token"
      }
    }
  }
}
```

#### Claude Code

##### Adding via CLI (`claude mcp add`)

To add globally (all projects):

```bash
claude mcp add bitbucket \
  -s user \
  -e BITBUCKET_EMAIL=your-email@example.com \
  -e BITBUCKET_TOKEN=your-bitbucket-token \
  -- docker run -i --rm -e BITBUCKET_EMAIL -e BITBUCKET_TOKEN bitbucket-mcp
```

To add for the current project only:

```bash
claude mcp add bitbucket \
  -s project \
  -e BITBUCKET_EMAIL=your-email@example.com \
  -e BITBUCKET_TOKEN=your-bitbucket-token \
  -- docker run -i --rm -e BITBUCKET_EMAIL -e BITBUCKET_TOKEN bitbucket-mcp
```

##### JSON configuration

`~/.claude/settings.json` (global) or project `.claude/settings.json`:

```json
{
  "mcpServers": {
    "bitbucket": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-e",
        "BITBUCKET_EMAIL",
        "-e",
        "BITBUCKET_TOKEN",
        "bitbucket-mcp"
      ],
      "env": {
        "BITBUCKET_EMAIL": "your-email@example.com",
        "BITBUCKET_TOKEN": "your-bitbucket-token"
      }
    }
  }
}
```

#### Without Docker (Direct Node.js)

```json
{
  "mcpServers": {
    "bitbucket": {
      "command": "node",
      "args": ["/path/to/bitbucket-mcp/dist/index.js"],
      "env": {
        "BITBUCKET_EMAIL": "your-email@example.com",
        "BITBUCKET_TOKEN": "your-bitbucket-token"
      }
    }
  }
}
```

## Development

- `npm install`: Install dependencies.
- `npm run build`: Create a bundle with Vite.
- `npm run dev`: Build in watch mode.

## Tools

### Repository

| Tool                | Description                          |
| ------------------- | ------------------------------------ |
| `list_repositories` | List repositories in a workspace     |
| `get_repository`    | Get details of a specific repository |

### File & Directory

| Tool               | Description                                  |
| ------------------ | -------------------------------------------- |
| `list_directory`   | List contents of a directory in a repository |
| `get_file_content` | Read the content of a file                   |

### Pull Request

| Tool                                         | Description                                                                     |
| -------------------------------------------- | ------------------------------------------------------------------------------- |
| `create_pull_request`                        | Create a new pull request                                                       |
| `update_pull_request`                        | Update pull request details (title, description, reviewers, destination branch) |
| `list_pull_requests`                         | List pull requests in a repository (OPEN, MERGED, DECLINED, SUPERSEDED)         |
| `get_pull_request`                           | Get details of a specific pull request                                          |
| `get_pull_request_diff`                      | Get the raw diff output of a pull request                                       |
| `get_pull_request_diffstat`                  | Get a summary of changed files in a pull request (lines added/removed)          |
| `list_pull_request_comments`                 | List all comments on a pull request                                             |
| `add_pull_request_comment`                   | Add a general or inline comment to a pull request (Markdown supported)          |
| `resolve_pull_request_comment`               | Resolve or unresolve a pull request comment                                     |
| `react_to_pull_request_comment`              | Add a reaction (e.g. thumbsup) to a pull request comment                        |
| `remove_reaction_from_pull_request_comment`  | Remove a reaction from a pull request comment                                   |
| `approve_pull_request`                       | Approve a pull request                                                          |
| `unapprove_pull_request`                     | Remove approval from a pull request                                             |
| `merge_pull_request`                         | Merge a pull request (merge_commit, squash, fast_forward)                       |
| `decline_pull_request`                       | Decline a pull request                                                          |

### Commit

| Tool           | Description              |
| -------------- | ------------------------ |
| `list_commits` | List commits in a branch |
