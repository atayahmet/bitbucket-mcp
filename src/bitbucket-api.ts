import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type {
  BitbucketRepository,
  BitbucketContent,
  BitbucketPullRequest,
  BitbucketCommit,
  BitbucketComment,
  BitbucketDiffstat,
} from './types.js';

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
    state: 'OPEN' | 'MERGED' | 'DECLINED' | 'SUPERSEDED' = 'OPEN'
  ): Promise<BitbucketPullRequest[]> {
    const response = await this.client.get(
      `/repositories/${workspace}/${repo_slug}/pullrequests`,
      {
        params: { q: `state="${state}"` },
      }
    );
    return response.data.values;
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
    const pr = await this.getPullRequest(workspace, repo_slug, pr_id);
    const spec = `${pr.destination.branch.name}..${pr.source.branch.name}`;
    const response = await this.client.get(
      `/repositories/${workspace}/${repo_slug}/diff/${spec}`,
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
    const pr = await this.getPullRequest(workspace, repo_slug, pr_id);
    const spec = `${pr.destination.branch.name}..${pr.source.branch.name}`;
    const response = await this.client.get(
      `/repositories/${workspace}/${repo_slug}/diffstat/${spec}`
    );
    return response.data.values;
  }

  async listPullRequestComments(
    workspace: string,
    repo_slug: string,
    pr_id: number
  ): Promise<BitbucketComment[]> {
    const response = await this.client.get(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/comments`
    );
    return response.data.values;
  }

  async addPullRequestComment(
    workspace: string,
    repo_slug: string,
    pr_id: number,
    body: string,
    inline?: { path: string; line: number }
  ): Promise<BitbucketComment> {
    const data: any = {
      content: { raw: body },
    };
    if (inline) {
      data.inline = { path: inline.path, to: inline.line };
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
  ): Promise<BitbucketComment> {
    const response = await this.client.put(
      `/repositories/${workspace}/${repo_slug}/pullrequests/${pr_id}/comments/${comment_id}`,
      { resolved }
    );
    return response.data;
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
