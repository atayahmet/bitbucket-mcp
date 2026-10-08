import axios from 'axios';
import type { AxiosInstance, AxiosResponse } from 'axios';
import type {
  BitbucketRepository,
  BitbucketContent,
  BitbucketPullRequest,
  BitbucketCommit,
  BitbucketComment,
  BitbucketDiffstat,
  BitbucketTask,
  BitbucketActivity,
  BitbucketPullRequestSummary,
} from './types.js';

const PULL_REQUEST_SUMMARY_FIELDS = [
  'id',
  'title',
  'description',
  'state',
  'draft',
  'author.display_name',
  'source.branch.name',
  'destination.branch.name',
  'merge_commit.hash',
  'created_on',
  'updated_on',
  'comment_count',
  'task_count',
]
  .map(field => `values.${field}`)
  .join(',');

// ISO 8601 timestamps in UTC, so they sort as strings.
const activityDate = (entry: BitbucketActivity): string =>
  entry.update?.date ??
  entry.approval?.date ??
  entry.changes_requested?.date ??
  entry.comment?.created_on ??
  '';

export class BitbucketClient {
  private client: AxiosInstance;

  constructor(email: string, token: string) {
    this.client = axios.create({
      baseURL: 'https://api.bitbucket.org/2.0',
      auth: {
        username: email,
        password: token,
      },
      headers: {
        Accept: 'application/json',
      },
    });
  }

  // Bitbucket returns a collection one page at a time (10 items unless `pagelen` says otherwise) and links the next
  // page in `next`; reading the first page's `values` alone silently drops the rest.
  private async collect<T>(
    url: string,
    params: Record<string, string> = {},
    limit: number = Number.POSITIVE_INFINITY
  ): Promise<T[]> {
    const items: T[] = [];
    let next: string | undefined = url;
    let query: Record<string, string | number> | undefined = { pagelen: 50, ...params };
    while (next !== undefined && items.length < limit) {
      const response: AxiosResponse<{ values: T[]; next?: string }> = await this.client.get(
        next,
        query === undefined ? {} : { params: query }
      );
      items.push(...response.data.values);
      next = response.data.next;
      // `next` is an absolute URL that already carries the query.
      query = undefined;
    }
    return items.slice(0, limit);
  }

  // A pull request's `diff` and `diffstat` answer with a redirect to the repository diff of its commits. Followed by
  // axios that redirect comes back 404, while the same URL requested directly succeeds, so follow it here.
  private async pullRequestDiffLocation(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    kind: 'diff' | 'diffstat'
  ): Promise<string> {
    const response = await this.client.get(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/${kind}`,
      { maxRedirects: 0, validateStatus: status => status === 302 }
    );
    return response.headers.location as string;
  }

  async listRepositories(workspace: string): Promise<BitbucketRepository[]> {
    const response = await this.client.get(`/repositories/${workspace}`);
    return response.data.values;
  }

  async getRepository(workspace: string, repo_slug: string): Promise<BitbucketRepository> {
    const response = await this.client.get(`/repositories/${workspace}/${repo_slug}`);
    return response.data;
  }

  async listDirectory(
    workspace: string,
    repo_slug: string,
    path: string = '',
    branch: string = 'main'
  ): Promise<BitbucketContent[]> {
    const response = await this.client.get(
      `/repositories/${workspace}/${repo_slug}/src/${branch}/${path}`
    );
    return response.data.values;
  }

  async getFileContent(
    workspace: string,
    repo_slug: string,
    path: string,
    branch: string = 'main'
  ): Promise<string> {
    const response = await this.client.get(
      `/repositories/${workspace}/${repo_slug}/src/${branch}/${path}`,
      {
        responseType: 'text',
      }
    );
    return response.data;
  }

  async createPullRequest(
    workspace: string,
    repo_slug: string,
    title: string,
    source_branch: string,
    destination_branch?: string,
    description?: string,
    close_source_branch: boolean = true
  ): Promise<BitbucketPullRequest> {
    const data: any = {
      title,
      source: {
        branch: { name: source_branch },
      },
      close_source_branch,
    };
    if (destination_branch) {
      data.destination = {
        branch: { name: destination_branch },
      };
    }
    if (description) {
      data.description = description;
    }
    const response = await this.client.post(
      `/repositories/${workspace}/${repo_slug}/pullrequests`,
      data
    );
    return response.data;
  }

  async updatePullRequest(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    update: {
      title?: string | undefined;
      description?: string | undefined;
      reviewers?: { uuid?: string; account_id?: string }[] | undefined;
      destination_branch?: string | undefined;
    }
  ): Promise<BitbucketPullRequest> {
    const data: any = {};
    if (update.title) data.title = update.title;
    if (update.description) data.description = update.description;
    if (update.reviewers) {
      data.reviewers = update.reviewers.map(r => {
        if (r.uuid) return { uuid: r.uuid };
        if (r.account_id) return { account_id: r.account_id };
        return r;
      });
    }
    if (update.destination_branch) {
      data.destination = { branch: { name: update.destination_branch } };
    }

    const response = await this.client.put(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}`,
      data
    );
    return response.data;
  }

  async listPullRequests(
    workspace: string,
    repo_slug: string,
    state: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED' = 'OPEN',
    limit: number = 20
  ): Promise<BitbucketPullRequestSummary[]> {
    return this.collect(
      `/repositories/${workspace}/${repo_slug}/pullrequests`,
      // A whole pull request is ~10 KB, mostly its rendered description and links: a page of them overflows a tool
      // result. `next` must be named too, or the response loses the link to the next page.
      { q: `state="${state}"`, fields: `next,${PULL_REQUEST_SUMMARY_FIELDS}` },
      limit
    );
  }

  async getPullRequest(
    workspace: string,
    repo_slug: string,
    pr_id: number
  ): Promise<BitbucketPullRequest> {
    const response = await this.client.get(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}`
    );
    return response.data;
  }

  async listCommits(
    workspace: string,
    repo_slug: string,
    branch: string = 'main'
  ): Promise<BitbucketCommit[]> {
    const response = await this.client.get(
      `/repositories/${workspace}/${repo_slug}/commits/${branch}`
    );
    return response.data.values;
  }

  async getPullRequestDiff(
    workspace: string,
    repo_slug: string,
    pr_id: number
  ): Promise<string> {
    // The pull request's own endpoint points at the diff of its source commit against the merge base with the
    // destination. Do not build a `{destination}..{source}` spec by hand: Bitbucket reads `A..B` as A's changes
    // since B (the reverse of git), so that returned what the destination gained, not what the PR changes.
    const response = await this.client.get(
      await this.pullRequestDiffLocation(workspace, repo_slug, pr_id, 'diff'),
      {
        responseType: 'text',
        headers: { Accept: 'text/plain' },
      }
    );
    return response.data;
  }

  async getPullRequestDiffstat(
    workspace: string,
    repo_slug: string,
    pr_id: number
  ): Promise<BitbucketDiffstat[]> {
    // As in getPullRequestDiff: the PR endpoint's location, not a hand-built spec.
    return this.collect(await this.pullRequestDiffLocation(workspace, repo_slug, pr_id, 'diffstat'));
  }

  async listPullRequestCommits(
    workspace: string,
    repo_slug: string,
    pr_id: number
  ): Promise<BitbucketCommit[]> {
    return this.collect(`/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/commits`);
  }

  async getPullRequestActivity(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    limit: number = 20
  ): Promise<BitbucketActivity[]> {
    const entries = await this.collect<BitbucketActivity>(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/activity`
    );
    // Bitbucket does not return the timeline in date order (a push and new replies can come after older comments),
    // so the first `limit` entries could miss the latest push: sort the whole timeline, newest first, then cut it.
    return entries
      .sort((a, b) => activityDate(b).localeCompare(activityDate(a)))
      .slice(0, limit);
  }

  async listPullRequestComments(
    workspace: string,
    repo_slug: string,
    pr_id: number
  ): Promise<BitbucketComment[]> {
    return this.collect(`/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/comments`, {
      // Every page now, so drop what repeats in each comment: the rendered HTML of `raw`, links, the pull request.
      fields: '-values.content.html,-values.links,-values.user.links,-values.pullrequest',
    });
  }

  async addPullRequestComment(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    body: string,
    inline?: {
      path: string;
      line: number;
      start_line?: number | undefined;
      side?: 'new' | 'old' | undefined;
    },
    parent_id?: number
  ): Promise<BitbucketComment> {
    const data: any = {
      content: { raw: body },
    };
    if (inline) {
      // `to`/`start_to` count lines of the new file and `from`/`start_from` those of the old one, the only side a
      // deleted line exists on. A start line makes it a multi-line comment ending at `line`.
      data.inline =
        inline.side === 'old'
          ? { path: inline.path, from: inline.line, start_from: inline.start_line }
          : { path: inline.path, to: inline.line, start_to: inline.start_line };
    }
    // A reply: Bitbucket threads it under the parent (and inherits the parent's inline anchor).
    if (parent_id !== undefined) {
      data.parent = { id: parent_id };
    }
    const response = await this.client.post(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/comments`,
      data
    );
    return response.data;
  }

  async resolvePullRequestComment(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    comment_id: number,
    resolved: boolean = true
  ): Promise<unknown> {
    // Resolution is its own sub-resource: POST resolves, DELETE reopens. A PUT of `{ resolved }` on
    // the comment itself is rejected with 400.
    const url = `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/comments/${comment_id}/resolve`;
    if (resolved) {
      const response = await this.client.post(url);
      return response.data;
    }
    await this.client.delete(url);
    return { comment_id, resolved: false };
  }

  async updatePullRequestComment(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    comment_id: number,
    body: string
  ): Promise<BitbucketComment> {
    const response = await this.client.put(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/comments/${comment_id}`,
      { content: { raw: body } }
    );
    return response.data;
  }

  async deletePullRequestComment(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    comment_id: number
  ): Promise<void> {
    await this.client.delete(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/comments/${comment_id}`
    );
  }

  async listPullRequestTasks(
    workspace: string,
    repo_slug: string,
    pr_id: number
  ): Promise<BitbucketTask[]> {
    return this.collect(`/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/tasks`);
  }

  async createPullRequestTask(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    content: string,
    comment_id?: number
  ): Promise<BitbucketTask> {
    const data: any = {
      content: { raw: content },
    };
    // Anchored to a comment, the task shows under it; without one it belongs to the pull request alone.
    if (comment_id !== undefined) {
      data.comment = { id: comment_id };
    }
    const response = await this.client.post(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/tasks`,
      data
    );
    return response.data;
  }

  async updatePullRequestTask(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    task_id: number,
    update: {
      content?: string | undefined;
      state?: 'RESOLVED' | 'UNRESOLVED' | undefined;
    }
  ): Promise<BitbucketTask> {
    const data: any = {};
    if (update.content) data.content = { raw: update.content };
    if (update.state) data.state = update.state;

    const response = await this.client.put(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/tasks/${task_id}`,
      data
    );
    return response.data;
  }

  async deletePullRequestTask(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    task_id: number
  ): Promise<void> {
    await this.client.delete(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/tasks/${task_id}`
    );
  }

  async reactToPullRequestComment(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    comment_id: number,
    reaction: string = 'thumbsup'
  ): Promise<void> {
    await this.client.post(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/comments/${comment_id}/reactions`,
      { key: reaction }
    );
  }

  async removeReactionFromPullRequestComment(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    comment_id: number,
    reaction: string = 'thumbsup'
  ): Promise<void> {
    await this.client.delete(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/comments/${comment_id}/reactions/${reaction}`
    );
  }

  async approvePullRequest(
    workspace: string,
    repo_slug: string,
    pr_id: number
  ): Promise<void> {
    await this.client.post(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/approve`
    );
  }

  async unapprovePullRequest(
    workspace: string,
    repo_slug: string,
    pr_id: number
  ): Promise<void> {
    await this.client.delete(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/approve`
    );
  }

  async requestChangesOnPullRequest(
    workspace: string,
    repo_slug: string,
    pr_id: number
  ): Promise<void> {
    await this.client.post(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/request-changes`
    );
  }

  async removeRequestChangesOnPullRequest(
    workspace: string,
    repo_slug: string,
    pr_id: number
  ): Promise<void> {
    await this.client.delete(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/request-changes`
    );
  }

  async mergePullRequest(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    merge_strategy: 'merge_commit' | 'squash' | 'fast_forward' = 'merge_commit',
    close_source_branch: boolean = true
  ): Promise<BitbucketPullRequest> {
    const response = await this.client.post(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/merge`,
      { type: 'pullrequest', merge_strategy, close_source_branch }
    );
    return response.data;
  }

  async declinePullRequest(
    workspace: string,
    repo_slug: string,
    pr_id: number
  ): Promise<BitbucketPullRequest> {
    const response = await this.client.post(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/decline`
    );
    return response.data;
  }
}
