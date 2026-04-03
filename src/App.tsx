/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  ExternalLink,
  FileArchive,
  FileCode2,
  FileJson,
  FolderTree,
  Github,
  Home,
  Info,
  Key,
  Loader2,
  Plus,
  Rocket,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRoundPlus,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import JSZip from 'jszip';
import { Octokit } from '@octokit/rest';
import { db, type GitHubToken, type Project, type RepoHistory } from './lib/db';

type AppTab = 'dashboard' | 'upload' | 'tools' | 'info';
type RepoFileAction = 'keep' | 'delete';

type StagedFile = {
  id: string;
  path: string;
  size: number;
  include: boolean;
  source: 'zip' | 'file' | 'folder';
  contentBase64: string;
};

type RepoFile = {
  path: string;
  sha: string;
  size: number;
  action: RepoFileAction;
};

const WEB_ICON = 'https://res.cloudinary.com/dwiozm4vz/image/upload/v1775203338/nalaxl1mo6eltckuzpoh.png';

const NAV_ITEMS: { id: AppTab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Home size={16} /> },
  { id: 'upload', label: 'Upload', icon: <Upload size={16} /> },
  { id: 'tools', label: 'Tools', icon: <BarChart3 size={16} /> },
  { id: 'info', label: 'Info Web', icon: <Info size={16} /> },
];

const getRecentActivity = (projects: Project[]) => {
  const now = new Date();
  const labels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  return [...Array(7)].map((_, i) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - i));
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const count = projects.filter((project) => (project.updatedAt ?? project.createdAt) >= dayStart.getTime() && (project.updatedAt ?? project.createdAt) <= dayEnd.getTime()).length;

    return {
      label: labels[date.getDay()],
      count,
    };
  });
};

const bytesToReadable = (value: number) => {
  if (!value) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), sizes.length - 1);
  return `${(value / (1024 ** i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
};

const toBase64 = async (file: File) => {
  const fileData = new Uint8Array(await file.arrayBuffer());
  const binary = Array.from(fileData, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary);
};

export default function App() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<GitHubToken | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [history, setHistory] = useState<RepoHistory[]>([]);
  const [repoName, setRepoName] = useState('');
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [repoFiles, setRepoFiles] = useState<RepoFile[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [isRepoLoading, setIsRepoLoading] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchProject, setSearchProject] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [hasGithubAccount, setHasGithubAccount] = useState<'yes' | 'no' | null>(null);
  const [repoCheckStatus, setRepoCheckStatus] = useState<'idle' | 'checking' | 'available' | 'exists'>('idle');
  const [tab, setTab] = useState<AppTab>('dashboard');
  const [hasStarted, setHasStarted] = useState(localStorage.getItem('repoflow_started') === 'true');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadUserData();
    loadProjects();
    loadHistory();
  }, []);

  useEffect(() => {
    if (!user || !repoName.trim()) {
      setRepoCheckStatus('idle');
      setRepoFiles([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setRepoCheckStatus('checking');
      try {
        const octokit = new Octokit({ auth: user.token });
        await octokit.repos.get({ owner: user.username, repo: repoName.trim() });
        setRepoCheckStatus('exists');
      } catch (err: any) {
        if (err?.status === 404) setRepoCheckStatus('available');
        else setRepoCheckStatus('idle');
      }
    }, 450);

    return () => clearTimeout(timeoutId);
  }, [repoName, user]);

  useEffect(() => {
    if (repoCheckStatus === 'exists' && user && repoName.trim()) {
      loadRepoFiles(repoName.trim());
    }
  }, [repoCheckStatus, repoName, user]);

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.repoName.toLowerCase().includes(searchProject.toLowerCase())),
    [projects, searchProject],
  );

  const activityData = useMemo(() => getRecentActivity(projects), [projects]);
  const totalWeekActivity = activityData.reduce((acc, curr) => acc + curr.count, 0);
  const maxActivity = Math.max(1, ...activityData.map((item) => item.count));
  const selectedStagedFiles = stagedFiles.filter((entry) => entry.include);
  const selectedTotalSize = selectedStagedFiles.reduce((sum, entry) => sum + entry.size, 0);
  const deletedRepoFiles = repoFiles.filter((item) => item.action === 'delete');

  const loadUserData = async () => {
    const savedTokens = await db.tokens.toArray();
    if (savedTokens.length > 0) {
      setUser(savedTokens[0]);
      setToken(savedTokens[0].token);
      setHasGithubAccount('yes');
    }
  };

  const loadProjects = async () => {
    const savedProjects = await db.projects.toArray();
    const sorted = savedProjects.sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt));
    setProjects(sorted);
  };

  const loadHistory = async () => {
    const rows = await db.history.orderBy('timestamp').reverse().limit(10).toArray();
    setHistory(rows);
  };

  const validateToken = async (inputToken: string) => {
    if (!inputToken.trim()) {
      setError('Token GitHub wajib diisi.');
      return;
    }

    try {
      setError(null);
      const octokit = new Octokit({ auth: inputToken.trim() });
      const { data } = await octokit.users.getAuthenticated();

      const userData: GitHubToken = {
        token: inputToken.trim(),
        username: data.login,
        avatarUrl: data.avatar_url,
      };

      await db.tokens.clear();
      await db.tokens.add(userData);
      setUser(userData);
      setSuccess('Akun GitHub berhasil terhubung.');
      setTimeout(() => setSuccess(null), 2200);
    } catch (err) {
      setError('Token tidak valid atau koneksi bermasalah.');
      console.error(err);
    }
  };

  const handleLogout = async () => {
    await db.tokens.clear();
    setUser(null);
    setToken('');
    setRepoCheckStatus('idle');
    setRepoFiles([]);
  };

  const upsertStagedFiles = (incoming: StagedFile[]) => {
    setStagedFiles((prev) => {
      const map = new Map<string, StagedFile>(prev.map((item) => [item.path, item]));
      incoming.forEach((item) => map.set(item.path, item));
      return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
    });
  };

  const parseZipFile = async (zipFile: File) => {
    const zip = new JSZip();
    const content = await zip.loadAsync(zipFile);
    const paths = Object.keys(content.files).filter((path) => !content.files[path].dir);

    const extracted: StagedFile[] = [];
    for (let i = 0; i < paths.length; i += 1) {
      const path = paths[i];
      const entry = content.files[path];
      const base64 = await entry.async('base64');
      const uint8 = await entry.async('uint8array');
      extracted.push({
        id: `zip-${zipFile.name}-${path}`,
        path,
        size: uint8.byteLength,
        include: true,
        source: 'zip',
        contentBase64: base64,
      });
      setExtractProgress(Math.round(((i + 1) / paths.length) * 100));
    }

    return extracted;
  };

  const handleInputFiles = async (fileList: FileList | null, source: 'file' | 'folder') => {
    if (!fileList || fileList.length === 0) return;

    try {
      setError(null);
      setIsExtracting(true);
      setExtractProgress(4);
      setStatus('Memproses file...');

      const files = Array.from(fileList);
      const parsed: StagedFile[] = [];

      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        if (file.name.toLowerCase().endsWith('.zip')) {
          setStatus(`Ekstrak ZIP: ${file.name}`);
          const zipRows = await parseZipFile(file);
          parsed.push(...zipRows);
        } else {
          const path = file.webkitRelativePath || file.name;
          parsed.push({
            id: `${source}-${path}-${file.lastModified}`,
            path,
            size: file.size,
            include: true,
            source,
            contentBase64: await toBase64(file),
          });
        }
      }

      upsertStagedFiles(parsed);
      setStatus(`File siap diupdate: ${parsed.length} file baru diproses.`);
      setExtractProgress(100);
    } catch (err) {
      setError('Gagal memproses file. Pastikan ZIP valid atau file tidak rusak.');
      console.error(err);
    } finally {
      setTimeout(() => {
        setIsExtracting(false);
        setExtractProgress(0);
      }, 400);
    }
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  const toggleStagedFile = (id: string) => {
    setStagedFiles((prev) => prev.map((item) => (item.id === id ? { ...item, include: !item.include } : item)));
  };

  const toggleRepoDelete = (path: string) => {
    setRepoFiles((prev) => prev.map((item) => (item.path === path ? { ...item, action: item.action === 'keep' ? 'delete' : 'keep' } : item)));
  };

  const loadRepoFiles = async (repo: string) => {
    if (!user) return;

    try {
      setIsRepoLoading(true);
      const octokit = new Octokit({ auth: user.token });
      const { data: repoData } = await octokit.repos.get({ owner: user.username, repo });
      const { data: branchData } = await octokit.repos.getBranch({ owner: user.username, repo, branch: repoData.default_branch });
      const { data: treeData } = await octokit.git.getTree({ owner: user.username, repo, tree_sha: branchData.commit.sha, recursive: 'true' });

      const rows: RepoFile[] = (treeData.tree || [])
        .filter((item) => item.type === 'blob' && Boolean(item.path) && Boolean(item.sha))
        .map((item) => ({
          path: item.path as string,
          sha: item.sha as string,
          size: item.size ?? 0,
          action: 'keep' as const,
        }))
        .sort((a, b) => a.path.localeCompare(b.path));

      setRepoFiles(rows);
    } catch (err: any) {
      setError(`Gagal baca isi repository: ${err?.message || 'unknown error'}`);
      setRepoFiles([]);
    } finally {
      setIsRepoLoading(false);
    }
  };

  const addHistory = async (action: RepoHistory['action'], repo: string, note: string) => {
    if (!user) return;
    await db.history.add({
      action,
      owner: user.username,
      repoName: repo,
      note,
      timestamp: Date.now(),
    });
    await loadHistory();
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const deployRepo = async () => {
    if (!user || !repoName.trim()) {
      setError('Isi nama repository terlebih dahulu.');
      return;
    }

    if (selectedStagedFiles.length === 0 && deletedRepoFiles.length === 0) {
      setError('Tidak ada perubahan. Tambah file atau tandai file repo untuk dihapus.');
      return;
    }

    setIsDeploying(true);
    setError(null);
    setProgress(8);
    setStatus('Menyiapkan push...');

    try {
      const octokit = new Octokit({ auth: user.token });
      const finalRepo = repoName.trim();
      let repoUrl = `https://github.com/${user.username}/${finalRepo}`;
      let repoExists = repoCheckStatus === 'exists';

      if (!repoExists) {
        const { data: repo } = await octokit.repos.createForAuthenticatedUser({
          name: finalRepo,
          auto_init: false,
        });
        repoUrl = repo.html_url;
        repoExists = true;
      }

      if (repoExists && repoFiles.length === 0) {
        await loadRepoFiles(finalRepo);
      }

      const repoFileMap = new Map<string, RepoFile>(repoFiles.map((file) => [file.path, file]));
      const totalOps = selectedStagedFiles.length + deletedRepoFiles.length;
      let doneOps = 0;

      for (const file of deletedRepoFiles) {
        setStatus(`Menghapus ${file.path}`);
        await octokit.repos.deleteFile({
          owner: user.username,
          repo: finalRepo,
          path: file.path,
          message: `Delete: ${file.path}`,
          sha: file.sha,
        });
        doneOps += 1;
        setProgress(15 + (doneOps / Math.max(1, totalOps)) * 82);
      }

      for (const file of selectedStagedFiles) {
        setStatus(`Memperbarui ${file.path}`);
        const existing = repoFileMap.get(file.path);
        await octokit.repos.createOrUpdateFileContents({
          owner: user.username,
          repo: finalRepo,
          path: file.path,
          message: `${existing ? 'Update' : 'Add'}: ${file.path}`,
          content: file.contentBase64,
          sha: existing?.sha,
        });
        doneOps += 1;
        setProgress(15 + (doneOps / Math.max(1, totalOps)) * 82);
      }

      const now = Date.now();
      const savedProjects = await db.projects.toArray();
      const current = savedProjects.find((item) => item.repoName === finalRepo && item.owner === user.username);
      const nextProject: Project = {
        id: current?.id,
        repoName: finalRepo,
        owner: user.username,
        url: current?.url ?? repoUrl,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
        fileCount: Math.max(0, repoFiles.length - deletedRepoFiles.length + selectedStagedFiles.length),
        lastAction: current ? 'updated' : 'created',
      };

      await db.projects.put(nextProject);
      await addHistory(current ? 'updated' : 'created', finalRepo, `+${selectedStagedFiles.length} file, -${deletedRepoFiles.length} file`);
      await loadProjects();

      setProgress(100);
      setStatus('Selesai. Perubahan sudah dipush ke GitHub.');
      setSuccess(`Update ${finalRepo} berhasil.`);
      setStagedFiles([]);
      await loadRepoFiles(finalRepo);

      setTimeout(() => {
        setIsDeploying(false);
        setSuccess(null);
        setStatus('');
        setProgress(0);
      }, 2000);
    } catch (err: any) {
      setError(`Push gagal: ${err?.message || 'Terjadi kesalahan.'}`);
      setIsDeploying(false);
    }
  };

  const deleteProject = async (project: Project) => {
    if (!user) return;
    if (!window.confirm(`Hapus repository "${project.repoName}" dari GitHub?`)) return;

    try {
      const octokit = new Octokit({ auth: user.token });
      await octokit.repos.delete({ owner: project.owner, repo: project.repoName });
      if (project.id) await db.projects.delete(project.id);
      await addHistory('deleted', project.repoName, 'Repository dihapus dari GitHub');
      await loadProjects();
      setSuccess('Repository berhasil dihapus.');
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(`Gagal menghapus repository: ${err.message}`);
      if (err.status === 404 && project.id) {
        await db.projects.delete(project.id);
        await loadProjects();
      }
    }
  };

  const startApp = () => {
    setHasStarted(true);
    localStorage.setItem('repoflow_started', 'true');
  };

  const renderRepoCards = (limit?: number) => {
    const rows = typeof limit === 'number' ? filteredProjects.slice(0, limit) : filteredProjects;

    if (rows.length === 0) {
      return (
        <div className="app-card p-6 text-center">
          <p className="text-xs text-zinc-500">Belum ada repository.</p>
        </div>
      );
    }

    return rows.map((project) => (
      <div key={project.id} className="app-card p-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-white font-semibold truncate">{project.repoName}</p>
          <p className="text-[11px] text-zinc-500">Ditambah: {new Date(project.createdAt).toLocaleString('id-ID')}</p>
          <p className="text-[11px] text-zinc-500">Update: {new Date(project.updatedAt ?? project.createdAt).toLocaleString('id-ID')}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => project.id && copyToClipboard(project.url, project.id)} className="icon-btn" title="Salin URL">
            {copiedId === project.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
          <a href={project.url} target="_blank" className="icon-btn" title="Buka GitHub" rel="noreferrer">
            <ExternalLink size={14} />
          </a>
          <button onClick={() => deleteProject(project)} className="icon-btn hover:text-red-400" title="Hapus repo">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    ));
  };

  const renderDashboard = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="app-card p-3">
          <p className="text-[11px] text-zinc-500">Total Repo</p>
          <p className="text-xl font-bold text-white mt-1">{projects.length}</p>
        </div>
        <div className="app-card p-3">
          <p className="text-[11px] text-zinc-500">Aktivitas 7 Hari</p>
          <p className="text-xl font-bold text-white mt-1">{totalWeekActivity}</p>
        </div>
        <div className="app-card p-3">
          <p className="text-[11px] text-zinc-500">File Di-stage</p>
          <p className="text-xl font-bold text-white mt-1">{selectedStagedFiles.length}</p>
        </div>
        <div className="app-card p-3">
          <p className="text-[11px] text-zinc-500">Ukuran Upload</p>
          <p className="text-base font-bold text-white mt-1">{bytesToReadable(selectedTotalSize)}</p>
        </div>
      </div>

      <div className="app-card p-3.5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Grafik Aktivitas Push</h3>
          <BarChart3 size={14} className="text-brand" />
        </div>
        <div className="flex items-end gap-2 h-28">
          {activityData.map((item) => (
            <div key={item.label} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-md bg-white/[0.04] h-20 flex items-end p-1">
                <div
                  className="w-full rounded-[6px] bg-gradient-to-t from-brand to-brand-light"
                  style={{ height: `${Math.max(8, (item.count / maxActivity) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="app-card p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Riwayat Perubahan Repo</h3>
          <FolderTree size={14} className="text-brand-light" />
        </div>
        <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
          {history.length === 0 ? (
            <p className="text-xs text-zinc-500">Belum ada history.</p>
          ) : (
            history.map((item) => (
              <div key={item.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
                <p className="text-xs text-white">{item.repoName} • {item.action.toUpperCase()}</p>
                <p className="text-[11px] text-zinc-400 break-words">{item.note}</p>
                <p className="text-[10px] text-zinc-500">{new Date(item.timestamp).toLocaleString('id-ID')}</p>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="app-card p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Repository Terbaru</h3>
          <button onClick={() => setTab('tools')} className="text-xs text-brand-light">Kelola di Tools</button>
        </div>
        <div className="space-y-2">{renderRepoCards(3)}</div>
      </div>
    </div>
  );

  const renderUpload = () => (
    <div className="space-y-3">
      <section className="app-card p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand/15 flex items-center justify-center">
              <Key size={15} className="text-brand-light" />
            </div>
            <h3 className="text-sm font-semibold text-white">Akses GitHub</h3>
          </div>
          {user && (
            <button onClick={handleLogout} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-300">
              Putuskan
            </button>
          )}
        </div>

        {!user ? (
          <div className="space-y-3">
            <p className="text-xs text-zinc-300">Apakah Anda sudah memiliki akun GitHub?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setHasGithubAccount('yes')}
                className={`text-xs py-2 rounded-lg border ${
                  hasGithubAccount === 'yes' ? 'bg-brand/20 border-brand/50 text-brand-light' : 'border-white/10 text-zinc-300'
                }`}
              >
                Sudah punya
              </button>
              <button
                onClick={() => setHasGithubAccount('no')}
                className={`text-xs py-2 rounded-lg border ${
                  hasGithubAccount === 'no' ? 'bg-brand/20 border-brand/50 text-brand-light' : 'border-white/10 text-zinc-300'
                }`}
              >
                Belum punya
              </button>
            </div>

            {hasGithubAccount === 'no' && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <p className="text-xs text-amber-100">Silakan daftar akun GitHub terlebih dahulu.</p>
                <a href="https://github.com/signup" target="_blank" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-100" rel="noreferrer">
                  <UserRoundPlus size={13} /> Daftar GitHub <ExternalLink size={13} />
                </a>
              </div>
            )}

            {hasGithubAccount === 'yes' && (
              <>
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Masukkan Personal Access Token"
                  className="input-modern text-sm"
                />
                <button onClick={() => validateToken(token)} className="btn-modern w-full text-sm py-2.5">
                  Hubungkan Token
                </button>
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo,delete_repo&description=RepoFlow_App"
                  target="_blank"
                  className="inline-flex items-center gap-2 text-xs text-zinc-400"
                  rel="noreferrer"
                >
                  <ShieldCheck size={13} /> Buat token di GitHub
                </a>
              </>
            )}
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-brand/[0.08] border border-brand/25 flex items-center gap-2.5">
            <img src={user.avatarUrl} alt={user.username} className="w-8 h-8 rounded-lg" />
            <p className="text-xs text-zinc-200">
              Login sebagai <span className="font-semibold text-white">@{user.username}</span>
            </p>
          </div>
        )}
      </section>

      <section className="app-card p-3.5 space-y-3">
        <h3 className="text-sm font-semibold text-white">Kontrol File Repository (tambah / hapus / update)</h3>
        <input
          type="text"
          value={repoName}
          onChange={(e) => setRepoName(e.target.value.replace(/\s+/g, '-'))}
          placeholder="nama-repository"
          className="input-modern text-sm"
        />

        {repoCheckStatus === 'checking' && <p className="text-[11px] text-zinc-500">Memeriksa nama repo...</p>}
        {repoCheckStatus === 'available' && <p className="text-[11px] text-green-400">Repo baru akan dibuat.</p>}
        {repoCheckStatus === 'exists' && <p className="text-[11px] text-amber-300">Repo sudah ada. Anda sedang mode update isi repo.</p>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="btn-modern text-sm py-2.5">
            <Plus size={15} /> Tambah Banyak File
          </button>
          <button onClick={() => folderInputRef.current?.click()} className="btn-modern text-sm py-2.5">
            <FolderTree size={15} /> Tambah Folder
          </button>
        </div>

        <input type="file" ref={fileInputRef} onChange={(e) => handleInputFiles(e.target.files, 'file')} className="hidden" multiple />
        <input type="file" ref={folderInputRef} onChange={(e) => handleInputFiles(e.target.files, 'folder')} className="hidden" multiple webkitdirectory="true" />

        {isExtracting && (
          <div className="space-y-1.5">
            <p className="text-xs text-zinc-300 flex items-start gap-1.5 break-words"><Loader2 size={14} className="animate-spin mt-[1px] shrink-0" /> <span className="break-all">{status || 'Ekstrak file...'}</span></p>
            <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-brand to-brand-light" initial={{ width: 0 }} animate={{ width: `${extractProgress}%` }} />
            </div>
          </div>
        )}

        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-300">File yang akan diupload/update ({selectedStagedFiles.length}/{stagedFiles.length})</p>
            <p className="text-[11px] text-zinc-500">{bytesToReadable(selectedTotalSize)}</p>
          </div>
          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
            {stagedFiles.length === 0 ? (
              <p className="text-xs text-zinc-500">Belum ada file tambahan.</p>
            ) : (
              stagedFiles.map((entry) => (
                <div key={entry.id} className="flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 bg-white/[0.03] border border-white/5">
                  <input type="checkbox" checked={entry.include} onChange={() => toggleStagedFile(entry.id)} />
                  <FileJson size={13} className="text-zinc-500 shrink-0" />
                  <span className="text-zinc-300 break-all" title={entry.path}>{entry.path}</span>
                  <span className="text-[10px] text-zinc-500 ml-auto shrink-0">{bytesToReadable(entry.size)}</span>
                  <button onClick={() => removeStagedFile(entry.id)} className="icon-btn" title="Hapus dari staging">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/20 p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-300">File existing di repo (root & nested folder)</p>
            {isRepoLoading && <Loader2 size={13} className="animate-spin text-zinc-500" />}
          </div>
          <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
            {repoFiles.length === 0 ? (
              <p className="text-xs text-zinc-500">Belum ada file existing atau repo belum dimuat.</p>
            ) : (
              repoFiles.map((entry) => (
                <div key={entry.path} className={`flex items-center gap-2 text-xs rounded-lg px-2 py-1.5 border ${entry.action === 'delete' ? 'bg-red-500/10 border-red-500/25' : 'bg-white/[0.03] border-white/5'}`}>
                  <FileCode2 size={13} className="text-zinc-500 shrink-0" />
                  <span className="text-zinc-300 break-all" title={entry.path}>{entry.path}</span>
                  <span className="text-[10px] text-zinc-500 ml-auto shrink-0">{bytesToReadable(entry.size)}</span>
                  <button onClick={() => toggleRepoDelete(entry.path)} className="icon-btn" title="Toggle hapus">
                    {entry.action === 'delete' ? <Check size={13} className="text-green-400" /> : <Trash2 size={13} className="text-red-400" />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <button
          onClick={deployRepo}
          disabled={isDeploying || !user || !repoName || (selectedStagedFiles.length === 0 && deletedRepoFiles.length === 0)}
          className="btn-modern w-full text-sm py-2.5"
        >
          {isDeploying ? <><Loader2 size={15} className="animate-spin" /> {status}</> : <><Rocket size={15} /> Push Pembaruan ke GitHub</>}
        </button>

        {isDeploying && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>Progress Push</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-brand to-brand-light" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
      </section>
    </div>
  );

  const renderTools = () => (
    <div className="space-y-3">
      <section className="app-card p-3.5 space-y-2.5">
        <h3 className="text-sm font-semibold text-white">Kelola Repository</h3>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={searchProject}
            onChange={(e) => setSearchProject(e.target.value)}
            placeholder="Cari repository"
            className="input-modern pl-9 text-sm"
          />
        </div>
      </section>

      <section className="space-y-2">{renderRepoCards()}</section>
    </div>
  );

  const renderInfo = () => (
    <div className="space-y-3">
      <section className="app-card p-3.5 space-y-2">
        <div className="flex items-center gap-2">
          <img src={WEB_ICON} alt="RepoFlow icon" className="w-8 h-8 rounded-lg border border-white/15" referrerPolicy="no-referrer" />
          <h3 className="text-sm font-semibold text-white">Tentang Website</h3>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed">
          RepoFlow mendukung kontrol file lebih lengkap: baca isi repo existing, tambah file massal/folder, dan hapus file root atau nested folder sebelum push.
        </p>
      </section>
    </div>
  );

  if (!hasStarted) {
    return (
      <div className="min-h-screen px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-md app-card p-5 space-y-4 text-center">
          <img src={WEB_ICON} alt="RepoFlow logo" className="w-12 h-12 rounded-2xl mx-auto border border-white/15" referrerPolicy="no-referrer" />
          <h1 className="text-xl font-bold text-white">Selamat Datang di RepoFlow</h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Aplikasi push project modern untuk update repository GitHub dari desktop dan mobile, tanpa perlu deploy hosting.
          </p>
          <button onClick={startApp} className="btn-modern w-full text-sm py-2.5">
            Lanjutkan ke Aplikasi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-[86px] md:pb-0">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-bg-dark/90 backdrop-blur-xl px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src={WEB_ICON} alt="RepoFlow logo" className="w-8 h-8 rounded-lg border border-white/15" referrerPolicy="no-referrer" />
            <div>
              <p className="text-xs text-zinc-500">RepoFlow App</p>
              <h1 className="text-sm text-white font-semibold">
                {tab === 'dashboard' && 'Dashboard'}
                {tab === 'upload' && 'Upload & Kontrol File'}
                {tab === 'tools' && 'Tools Repository'}
                {tab === 'info' && 'Info Website'}
              </h1>
            </div>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <Github size={14} className="text-zinc-400" />
              <span className="text-xs text-zinc-300">@{user.username}</span>
            </div>
          ) : (
            <span className="text-[11px] text-zinc-500">Belum terhubung</span>
          )}
        </div>
      </header>

      <main className="px-3 py-3 md:px-6">
        <div className="max-w-6xl mx-auto md:grid md:grid-cols-[220px_1fr] md:gap-4">
          <aside className="hidden md:block app-card p-2 h-fit sticky top-[86px]">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-1 ${tab === item.id ? 'text-brand-light bg-brand/10' : 'text-zinc-400 hover:bg-white/[0.04]'}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </aside>

          <div>
            <AnimatePresence mode="wait">
              <motion.div
                key={tab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                {(error || success) && (
                  <div className={`mb-3 p-2.5 rounded-xl text-xs flex items-center gap-2 border ${error ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-green-500/10 border-green-500/20 text-green-300'}`}>
                    {error ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />} {error || success}
                  </div>
                )}

                {tab === 'dashboard' && renderDashboard()}
                {tab === 'upload' && renderUpload()}
                {tab === 'tools' && renderTools()}
                {tab === 'info' && renderInfo()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl z-50 pb-[calc(0.35rem+env(safe-area-inset-bottom))]">
        <div className="max-w-xl mx-auto grid grid-cols-4 gap-1 px-2 pt-1.5">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] ${tab === item.id ? 'text-brand-light bg-brand/10' : 'text-zinc-400'}`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
