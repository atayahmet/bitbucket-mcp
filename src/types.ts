export interface BitbucketRepository {
  slug: string;
  name: string;
  full_name: string;
  description: string;
  workspace: {
    slug: string;
    name: string;
  };
  links: {
    html: { href: string };
  };
}

export interface BitbucketContent {
  path: string;
  type: 'commit_directory' | 'commit_file';
  size?: number;
  links: {
    self: { href: string };
  };
}

export interface BitbucketPullRequest {
  id: number;
  title: string;
  description: string;
  state: string;
  author: {
    display_name: string;
    account_id: string;
  };
  source: {
    branch: { name: string };
    repository: { full_name: string };
  };
  destination: {
    branch: { name: string };
    repository: { full_name: string };
  };
  links: {
    diff: { href: string };
    diffstat: { href: string };
    html: { href: string };
  };
}

export interface BitbucketCommit {
  hash: string;
  message: string;
  date: string;
  author: {
    raw: string;
    user?: {
      display_name: string;
    };
  };
}

export interface BitbucketComment {
  id: number;
  content: {
    raw: string;
    markup: string;
    html: string;
  };
  user: {
    display_name: string;
    account_id: string;
  };
  created_on: string;
  updated_on: string;
  inline?: {
    path: string;
    from?: number | null;
    to?: number | null;
  };
  parent?: {
    id: number;
  };
  resolved?: boolean;
}

export interface BitbucketDiffstat {
  status: 'added' | 'removed' | 'modified' | 'renamed';
  old?: { path: string };
  new?: { path: string };
  lines_added: number;
  lines_removed: number;
}
