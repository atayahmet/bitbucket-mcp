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

/** A pull request as `list_pull_requests` returns it: the fields named in PULL_REQUEST_SUMMARY_FIELDS. */
export interface BitbucketPullRequestSummary {
  id: number;
  title: string;
  description: string;
  state: string;
  draft: boolean;
  author: { display_name: string };
  source: { branch: { name: string } };
  destination: { branch: { name: string } };
  merge_commit: { hash: string } | null;
  created_on: string;
  updated_on: string;
  comment_count: number;
  task_count: number;
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
    start_from?: number | null;
    start_to?: number | null;
  };
  parent?: {
    id: number;
  };
  resolved?: boolean;
}

export interface BitbucketTask {
  id: number;
  state: 'RESOLVED' | 'UNRESOLVED';
  content: {
    raw: string;
    markup: string;
    html: string;
  };
  creator: {
    display_name: string;
    account_id: string;
  };
  created_on: string;
  updated_on: string;
  resolved_on?: string | null;
  resolved_by?: {
    display_name: string;
    account_id: string;
  } | null;
  comment?: {
    id: number;
  };
  pending: boolean;
}

/** One entry of a pull request's timeline; exactly one of the optional keys is set. */
export interface BitbucketActivity {
  pull_request: {
    id: number;
    title: string;
  };
  update?: {
    state: string;
    date: string;
    title: string;
    author: { display_name: string; account_id: string };
    source: { commit: { hash: string } };
    destination: { commit: { hash: string } };
  };
  approval?: {
    date: string;
    user: { display_name: string; account_id: string };
  };
  changes_requested?: {
    date: string;
    user: { display_name: string; account_id: string };
  };
  comment?: BitbucketComment;
}

export interface BitbucketDiffstat {
  status: 'added' | 'removed' | 'modified' | 'renamed';
  old?: { path: string };
  new?: { path: string };
  lines_added: number;
  lines_removed: number;
}
