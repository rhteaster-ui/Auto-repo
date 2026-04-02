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
}

export class MyDatabase extends Dexie {
  tokens!: Table<GitHubToken>;
  projects!: Table<Project>;

  constructor() {
    super('RepoFlowDB');
    this.version(2).stores({
      tokens: '++id, token, username',
      projects: '++id, repoName, owner, createdAt'
    });
  }
}

export const db = new MyDatabase();
