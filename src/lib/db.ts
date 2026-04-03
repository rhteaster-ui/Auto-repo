import Dexie, { type Table } from 'dexie';

export interface GitHubToken {
  id?: number;
  token: string;
  username: string;
  avatarUrl: string;
}

export interface Project {
  id?: number;
  repoName: string;
  owner: string;
  url: string;
  createdAt: number;
  updatedAt: number;
  lastSyncedAt?: number;
  totalFiles?: number;
  lastAction?: string;
  lastActionAt?: number;
}

export interface ActivityLog {
  id?: number;
  repoName: string;
  owner: string;
  action: 'create_repo' | 'sync_repo' | 'update_repo' | 'delete_repo';
  detail: string;
  createdAt: number;
}

export class MyDatabase extends Dexie {
  tokens!: Table<GitHubToken>;
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
      tokens: '++id, token, username',
      projects: '++id, repoName, owner, createdAt, updatedAt, lastSyncedAt, lastActionAt',
      logs: '++id, repoName, owner, action, createdAt',
    }).upgrade((tx) => tx.table('projects').toCollection().modify((project: Project) => {
      if (!project.lastActionAt) project.lastActionAt = project.updatedAt || project.createdAt;
      if (!project.lastAction) project.lastAction = 'Repository dibuat';
    }));
  }
}

export const db = new MyDatabase();
