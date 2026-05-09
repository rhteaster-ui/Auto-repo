import Dexie, { type Table } from 'dexie';

export interface GitHubAccount {
  id?: number;
  label: string;
  token: string;
  username: string;
  avatarUrl?: string;
  tokenType: 'classic' | 'fine-grained' | 'unknown';
  active: 0 | 1;
  createdAt: number;
  lastValidatedAt: number;
}

export interface Project {
  accountId?: number;
  id?: number;
  repoName: string;
  owner: string;
  url: string;
  createdAt: number;
  updatedAt: number;
  lastSyncedAt?: number;
  totalFiles?: number;
}

export interface ActivityLog {
  accountId?: number;
  id?: number;
  repoName: string;
  owner: string;
  action: 'create_repo' | 'sync_repo' | 'update_repo' | 'delete_repo';
  detail: string;
  createdAt: number;
}

export class MyDatabase extends Dexie {
  accounts!: Table<GitHubAccount>;
  projects!: Table<Project>;
  logs!: Table<ActivityLog>;

  constructor() {
    super('RepoFlowDB');
    this.version(2).stores({
      tokens: '++id, token, username',
      projects: '++id, repoName, owner, createdAt'
    });
    this.version(3).stores({
      tokens: '++id, token, username',
      projects: '++id, repoName, owner, createdAt, updatedAt, lastSyncedAt',
      logs: '++id, repoName, owner, action, createdAt',
    }).upgrade((tx) => tx.table('projects').toCollection().modify((project: Project) => {
      if (!project.updatedAt) project.updatedAt = project.createdAt;
    }));

    this.version(4).stores({
      accounts: '++id, label, username, active, createdAt, lastValidatedAt',
      projects: '++id, accountId, repoName, owner, createdAt, updatedAt, lastSyncedAt',
      logs: '++id, accountId, repoName, owner, action, createdAt',
    }).upgrade(async (tx) => {
      const oldTokens = await tx.table('tokens').toArray();
      const accounts = tx.table('accounts');
      const now = Date.now();
      for (const token of oldTokens) {
        await accounts.add({
          label: token.username || 'Akun GitHub',
          token: token.token,
          username: token.username,
          avatarUrl: token.avatarUrl,
          tokenType: token.token?.startsWith('github_pat_') ? 'fine-grained' : 'classic',
          active: 1,
          createdAt: now,
          lastValidatedAt: now,
        });
      }
    });
  }
}

export const db = new MyDatabase();
