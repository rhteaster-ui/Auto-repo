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
  updatedAt?: number;
  fileCount?: number;
  lastAction?: 'created' | 'updated';
}

export interface RepoHistory {
  id?: number;
  repoName: string;
  owner: string;
  action: 'created' | 'updated' | 'deleted';
  timestamp: number;
  note: string;
}

export class MyDatabase extends Dexie {
  tokens!: Table<GitHubToken>;
  projects!: Table<Project>;
  history!: Table<RepoHistory>;

  constructor() {
    super('RepoFlowDB');

    this.version(2).stores({
      tokens: '++id, token, username',
      projects: '++id, repoName, owner, createdAt',
    });

    this.version(3).stores({
      tokens: '++id, token, username',
      projects: '++id, repoName, owner, createdAt, updatedAt',
      history: '++id, repoName, owner, timestamp, action',
    });
  }
}

export const db = new MyDatabase();
