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
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  FileArchive,
  FileCode2,
  FileJson,
  FileText,
  FolderOpen,
  Github,
  Home,
  Info,
  Key,
  Loader2,
  RefreshCcw,
  Rocket,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRoundPlus,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import JSZip from 'jszip';
import { Octokit } from '@octokit/rest';
import { db, type GitHubToken, type Project, type ActivityLog } from './lib/db';

type AppTab = 'dashboard' | 'upload' | 'tools' | 'info';

type UploadEntry = {
  id: string;
  path: string;
  size: number;
  source: 'zip' | 'single';
  include: boolean;
  contentBase64: string;
};

type RepoFileEntry = {
  path: string;
  sha: string;
  size: number;
};

type RepoTreeNode = {
  name: string;
  path: string;
  type: 'file' | 'folder';
  size?: number;
  children?: RepoTreeNode[];
};

type StagedFile = {
  id: string;
  path: string;
  size: number;
  contentBase64: string;
};

const WEB_ICON = 'https://res.cloudinary.com/dwiozm4vz/image/upload/v1775203338/nalaxl1mo6eltckuzpoh.png';
const DEV_PROFILE_IMAGE = 'https://res.cloudinary.com/dwiozm4vz/image/upload/v1772959730/ootglrvfmykn6xsto7rq.png';

const SOCIAL_LINKS = [
  { label: 'WhatsApp Channel', url: 'https://whatsapp.com/channel/0029VbBjyjlJ93wa6hwSWa0p' },
  { label: 'Instagram', url: 'https://www.instagram.com/rahmt_nhw?igsh=MWQwcnB3bTA2ZnVidg==' },
  { label: 'TikTok', url: 'https://www.tiktok.com/@r_hmtofc?_r=1&_t=ZS-94KRfWQjeUu' },
  { label: 'Telegram', url: 'https://t.me/rAi_engine' },
];

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
    const count = projects.filter((p) => p.updatedAt >= dayStart.getTime() && p.updatedAt <= dayEnd.getTime()).length;
    return { label: labels[date.getDay()], count };
  });
};

const bytesToReadable = (value: number) => {
  if (!value) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(value) / Math.log(1024)), sizes.length - 1);
  return `${(value / (1024 ** i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
};

const formatActionLabel = (action: ActivityLog['action']) => {
  if (action === 'create_repo') return 'Repo dibuat';
  if (action === 'sync_repo') return 'Sinkronisasi';
  if (action === 'update_repo') return 'Perubahan file';
  return 'Repo dihapus';
};

const buildRepoTree = (files: RepoFileEntry[]) => {
  const root: RepoTreeNode[] = [];
  const folderMap = new Map<string, RepoTreeNode>();

  const ensureFolder = (path: string, name: string, parentPath: string) => {
    if (folderMap.has(path)) return folderMap.get(path)!;
    const node: RepoTreeNode = { name, path, type: 'folder', children: [] };
    folderMap.set(path, node);
    if (!parentPath) {
      root.push(node);
    } else {
      const parent = folderMap.get(parentPath);
      parent?.children?.push(node);
    }
    return node;
  };

  files.forEach((file) => {
    const parts = file.path.split('/');
    let currentPath = '';
    let parentPath = '';
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const isLast = i === parts.length - 1;
      if (isLast) {
        const fileNode: RepoTreeNode = { name: part, path: file.path, type: 'file', size: file.size };
        if (!parentPath) root.push(fileNode);
        else folderMap.get(parentPath)?.children?.push(fileNode);
      } else {
        ensureFolder(currentPath, part, parentPath);
        parentPath = currentPath;
      }
    }
  });

  const sortNodes = (nodes: RepoTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((node) => node.children && sortNodes(node.children));
  };
  sortNodes(root);
  return root;
};

const toBase64 = async (file: File) => {
  const buff = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  buff.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
};

export default function App() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<GitHubToken | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [repoName, setRepoName] = useState('');
  const [uploadEntries, setUploadEntries] = useState<UploadEntry[]>([]);
  const [pickedFileNames, setPickedFileNames] = useState<string[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
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

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [repoFiles, setRepoFiles] = useState<RepoFileEntry[]>([]);
  const [baseShas, setBaseShas] = useState<Record<string, string>>({});
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [deletedPaths, setDeletedPaths] = useState<string[]>([]);
  const [folderPrefix, setFolderPrefix] = useState('');
  const [syncingRepo, setSyncingRepo] = useState(false);
  const [savingRepo, setSavingRepo] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<string[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [activeFileContent, setActiveFileContent] = useState('');
  const [activeFileLoading, setActiveFileLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const updateInputRef = useRef<HTMLInputElement>(null);
  const updateFolderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadUserData();
    loadProjects();
    loadLogs();
  }, []);

  useEffect(() => {
    if (!user || !repoName.trim()) {
      setRepoCheckStatus('idle');
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

  const filteredProjects = useMemo(
    () => projects.filter((p) => p.repoName.toLowerCase().includes(searchProject.toLowerCase())),
    [projects, searchProject],
  );

  const activityData = useMemo(() => getRecentActivity(projects), [projects]);
  const totalWeekActivity = activityData.reduce((acc, curr) => acc + curr.count, 0);
  const maxActivity = Math.max(1, ...activityData.map((item) => item.count));
  const selectedEntries = uploadEntries.filter((entry) => entry.include);
  const selectedTotalSize = selectedEntries.reduce((sum, entry) => sum + entry.size, 0);
  const selectedProject = projects.find((p) => p.id === selectedProjectId) || null;
  const repoFolders = useMemo(() => {
    const folders = new Set<string>();
    repoFiles.forEach((file) => {
      const parts = file.path.split('/');
      for (let i = 1; i < parts.length; i += 1) folders.add(parts.slice(0, i).join('/'));
    });
    return [...folders].sort((a, b) => a.localeCompare(b));
  }, [repoFiles]);
  const repoTree = useMemo(() => buildRepoTree(repoFiles), [repoFiles]);

  const loadUserData = async () => {
    const savedTokens = await db.tokens.toArray();
    if (savedTokens.length > 0) {
      setUser(savedTokens[0]);
      setToken(savedTokens[0].token);
      setHasGithubAccount('yes');
    }
  };

  const loadProjects = async () => {
    const savedProjects = await db.projects.orderBy('updatedAt').reverse().toArray();
    setProjects(savedProjects);
  };

  const loadLogs = async () => {
    const savedLogs = await db.logs.orderBy('createdAt').reverse().limit(40).toArray();
    setLogs(savedLogs);
  };

  const addLog = async (log: Omit<ActivityLog, 'id' | 'createdAt'>) => {
    await db.logs.add({ ...log, createdAt: Date.now() });
    await loadLogs();
  };

  const upsertProjectMeta = async (project: Project, info: Partial<Project>) => {
    if (!project.id) return;
    await db.projects.update(project.id, { ...info, updatedAt: Date.now() });
    await loadProjects();
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
      const userData: GitHubToken = { token: inputToken.trim(), username: data.login, avatarUrl: data.avatar_url };
      await db.tokens.clear();
      await db.tokens.add(userData);
      setUser(userData);
      setSuccess('Akun GitHub berhasil terhubung.');
      setTimeout(() => setSuccess(null), 2200);
    } catch {
      setError('Token tidak valid atau koneksi bermasalah.');
    }
  };

  const handleLogout = async () => {
    await db.tokens.clear();
    setUser(null);
    setToken('');
    setRepoCheckStatus('idle');
  };

  const extractEntries = async (files: FileList) => {
    setIsExtracting(true);
    setExtractProgress(8);
    const list = Array.from(files);
    const nextEntries: UploadEntry[] = [];
    setPickedFileNames(list.map((f) => f.name));

    for (let index = 0; index < list.length; index += 1) {
      const file = list[index];
      if (file.name.toLowerCase().endsWith('.zip')) {
        const zip = await new JSZip().loadAsync(file);
        const paths = Object.keys(zip.files).filter((path) => !zip.files[path].dir);
        for (let i = 0; i < paths.length; i += 1) {
          const p = paths[i];
          const zipFile = zip.files[p];
          const fileBuffer = await zipFile.async('uint8array');
          const contentBase64 = await zipFile.async('base64');
          nextEntries.push({
            id: `${file.name}:${p}`,
            path: p,
            size: fileBuffer.length,
            source: 'zip',
            include: true,
            contentBase64,
          });
        }
      } else {
        nextEntries.push({
          id: `${file.name}:${crypto.randomUUID()}`,
          path: file.webkitRelativePath || file.name,
          size: file.size,
          source: 'single',
          include: true,
          contentBase64: await toBase64(file),
        });
      }
      setExtractProgress(Math.round(((index + 1) / list.length) * 100));
    }

    setUploadEntries(nextEntries);
    setStatus(`Total ${nextEntries.length} file siap diproses.`);
    setTimeout(() => {
      setIsExtracting(false);
      setExtractProgress(0);
    }, 250);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    try {
      setError(null);
      setStatus('Menganalisis file...');
      await extractEntries(e.target.files);
    } catch {
      setUploadEntries([]);
      setError('File tidak bisa dibaca. Pastikan ZIP valid atau file tidak rusak.');
    } finally {
      e.target.value = '';
    }
  };

  const toggleUploadEntry = (id: string) => {
    setUploadEntries((prev) => prev.map((item) => (item.id === id ? { ...item, include: !item.include } : item)));
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const deployRepo = async () => {
    if (!user || !repoName.trim()) return setError('Lengkapi nama repository.');
    if (selectedEntries.length === 0) return setError('Pilih minimal 1 file untuk dipush ke GitHub.');
    if (repoCheckStatus === 'exists') return setError('Nama repository sudah dipakai. Gunakan nama lain.');

    setIsDeploying(true);
    setError(null);
    setProgress(10);

    try {
      const octokit = new Octokit({ auth: user.token });
      const finalRepo = repoName.trim();
      const { data: repo } = await octokit.repos.createForAuthenticatedUser({ name: finalRepo, auto_init: false });
      setStatus('Mengunggah file awal...');

      for (let i = 0; i < selectedEntries.length; i += 1) {
        const file = selectedEntries[i];
        await octokit.repos.createOrUpdateFileContents({
          owner: user.username,
          repo: finalRepo,
          path: file.path,
          message: `Initial commit: ${file.path}`,
          content: file.contentBase64,
        });
        setProgress(20 + ((i + 1) / selectedEntries.length) * 75);
      }

      const now = Date.now();
      const newProject: Project = {
        repoName: finalRepo,
        owner: user.username,
        url: repo.html_url,
        createdAt: now,
        updatedAt: now,
        lastSyncedAt: now,
        totalFiles: selectedEntries.length,
      };

      await db.projects.add(newProject);
      await addLog({ repoName: finalRepo, owner: user.username, action: 'create_repo', detail: `Repo dibuat dengan ${selectedEntries.length} file.` });
      await loadProjects();

      setProgress(100);
      setSuccess(`Push ${finalRepo} berhasil.`);
      setRepoName('');
      setUploadEntries([]);
      setPickedFileNames([]);
      setRepoCheckStatus('idle');
    } catch (err: any) {
      setError(`Push gagal: ${err?.message || 'Terjadi kesalahan.'}`);
    } finally {
      setIsDeploying(false);
      setTimeout(() => {
        setSuccess(null);
        setStatus('');
        setProgress(0);
      }, 1800);
    }
  };

  const getSnapshot = async (project: Project) => {
    if (!user) throw new Error('Akun belum terhubung');
    const octokit = new Octokit({ auth: user.token });
    const { data: repo } = await octokit.repos.get({ owner: project.owner, repo: project.repoName });
    const branch = repo.default_branch;
    const { data: branchData } = await octokit.repos.getBranch({ owner: project.owner, repo: project.repoName, branch });
    const { data: tree } = await octokit.git.getTree({
      owner: project.owner,
      repo: project.repoName,
      tree_sha: branchData.commit.sha,
      recursive: 'true',
    });

    const files: RepoFileEntry[] = tree.tree
      .filter((item) => item.type === 'blob' && item.path && item.sha)
      .map((item) => ({ path: item.path!, sha: item.sha!, size: item.size || 0 }))
      .sort((a, b) => a.path.localeCompare(b.path));

    return { files, headSha: branchData.commit.sha };
  };

  const syncSelectedRepo = async (project?: Project, opts?: { silent?: boolean }) => {
    const target = project || selectedProject;
    if (!target || !user) return;

    try {
      setSyncingRepo(true);
      setError(null);
      const snapshot = await getSnapshot(target);
      setRepoFiles(snapshot.files);
      setBaseShas(Object.fromEntries(snapshot.files.map((f) => [f.path, f.sha])));
      setDeletedPaths([]);
      setStagedFiles([]);
      setExpandedFolders([]);
      if (activeFilePath && !snapshot.files.find((item) => item.path === activeFilePath)) {
        setActiveFilePath(null);
        setActiveFileContent('');
      }
      await upsertProjectMeta(target, { lastSyncedAt: Date.now(), totalFiles: snapshot.files.length });
      if (!opts?.silent) {
        await addLog({ repoName: target.repoName, owner: target.owner, action: 'sync_repo', detail: `Sinkronisasi ${snapshot.files.length} file.` });
        setSuccess(`Repo ${target.repoName} tersinkron realtime.`);
        setTimeout(() => setSuccess(null), 1600);
      }
    } catch (err: any) {
      setError(`Gagal sinkron: ${err?.message || 'unknown error'}`);
    } finally {
      setSyncingRepo(false);
    }
  };

  useEffect(() => {
    if (tab !== 'tools' || !selectedProject || !user) return undefined;
    syncSelectedRepo(selectedProject, { silent: true });
    const intervalId = window.setInterval(() => {
      syncSelectedRepo(selectedProject, { silent: true });
    }, 15000);
    return () => window.clearInterval(intervalId);
  }, [tab, selectedProject?.id, user?.username]);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));
  };

  const loadFileContent = async (path: string) => {
    if (!selectedProject || !user) return;
    try {
      setActiveFilePath(path);
      setActiveFileLoading(true);
      setError(null);
      const octokit = new Octokit({ auth: user.token });
      const { data } = await octokit.repos.getContent({
        owner: selectedProject.owner,
        repo: selectedProject.repoName,
        path,
      });

      if (!('content' in data) || !data.content) {
        setActiveFileContent('File tidak dapat ditampilkan (mungkin binary atau kosong).');
        return;
      }
      const normalized = data.content.replace(/\n/g, '');
      const decoded = atob(normalized);
      setActiveFileContent(decoded);
    } catch {
      setActiveFileContent('Gagal membaca isi file ini.');
    } finally {
      setActiveFileLoading(false);
    }
  };

  const handleStageFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    const files = Array.from(e.target.files as FileList) as File[];
    const normalizedPrefix = folderPrefix.trim().replace(/^\/+|\/+$/g, '');
    const staged: StagedFile[] = await Promise.all(files.map(async (f) => ({
      id: crypto.randomUUID(),
      path: `${normalizedPrefix ? `${normalizedPrefix}/` : ''}${f.webkitRelativePath || f.name}`,
      size: f.size,
      contentBase64: await toBase64(f),
    })));

    setStagedFiles((prev) => {
      const map = new Map<string, StagedFile>(prev.map((item) => [item.path, item]));
      staged.forEach((item) => map.set(item.path, item));
      return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
    });
    e.target.value = '';
  };

  const toggleDeletePath = (path: string) => {
    setDeletedPaths((prev) => (prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]));
  };

  const removeStagedFile = (path: string) => {
    setStagedFiles((prev) => prev.filter((f) => f.path !== path));
  };

  const applyRepoChanges = async () => {
    if (!selectedProject || !user) return;
    if (stagedFiles.length === 0 && deletedPaths.length === 0) {
      setError('Belum ada perubahan yang disiapkan.');
      return;
    }

    try {
      setSavingRepo(true);
      setError(null);
      const latest = await getSnapshot(selectedProject);
      const latestMap = Object.fromEntries(latest.files.map((f) => [f.path, f.sha]));

      const conflicts = [...deletedPaths, ...stagedFiles.map((f) => f.path)].filter((path) => {
        const base = baseShas[path];
        if (!base && latestMap[path]) return true;
        return Boolean(base && latestMap[path] && latestMap[path] !== base);
      });

      if (conflicts.length > 0) {
        setError(`Konflik terdeteksi (${conflicts.length} file). Sinkronkan ulang dulu agar edit di GitHub tidak hilang.`);
        return;
      }

      const octokit = new Octokit({ auth: user.token });
      let done = 0;
      const total = stagedFiles.length + deletedPaths.length;

      for (const staged of stagedFiles) {
        await octokit.repos.createOrUpdateFileContents({
          owner: selectedProject.owner,
          repo: selectedProject.repoName,
          path: staged.path,
          message: `Update file via RepoFlow: ${staged.path}`,
          content: staged.contentBase64,
          sha: latestMap[staged.path],
        });
        done += 1;
        setStatus(`Menerapkan perubahan ${done}/${total}`);
      }

      for (const path of deletedPaths) {
        if (!latestMap[path]) continue;
        await octokit.repos.deleteFile({
          owner: selectedProject.owner,
          repo: selectedProject.repoName,
          path,
          message: `Delete file via RepoFlow: ${path}`,
          sha: latestMap[path],
        });
        done += 1;
        setStatus(`Menerapkan perubahan ${done}/${total}`);
      }

      await addLog({
        repoName: selectedProject.repoName,
        owner: selectedProject.owner,
        action: 'update_repo',
        detail: `Update ${stagedFiles.length} file + hapus ${deletedPaths.length} file.`,
      });
      await syncSelectedRepo(selectedProject);
      setSuccess('Perubahan repository berhasil disimpan.');
      setTimeout(() => setSuccess(null), 1800);
    } catch (err: any) {
      setError(`Gagal menyimpan perubahan: ${err?.message || 'unknown error'}`);
    } finally {
      setSavingRepo(false);
    }
  };

  const deleteProject = async (project: Project) => {
    if (!user) return;
    if (!window.confirm(`Hapus repository "${project.repoName}" dari GitHub?`)) return;

    try {
      const octokit = new Octokit({ auth: user.token });
      await octokit.repos.delete({ owner: project.owner, repo: project.repoName });
      if (project.id) await db.projects.delete(project.id);
      await addLog({ repoName: project.repoName, owner: project.owner, action: 'delete_repo', detail: 'Repository dihapus dari GitHub.' });
      await loadProjects();
      setSuccess('Repository berhasil dihapus.');
      if (selectedProjectId === project.id) {
        setSelectedProjectId(null);
        setRepoFiles([]);
      }
      setTimeout(() => setSuccess(null), 2000);
    } catch (err: any) {
      setError(`Gagal menghapus repository: ${err.message}`);
    }
  };

  const startApp = () => {
    setHasStarted(true);
    localStorage.setItem('repoflow_started', 'true');
  };

  const renderRepoTreeNodes = (nodes: RepoTreeNode[], level = 0): React.ReactNode => nodes.map((node) => {
    if (node.type === 'folder') {
      const opened = expandedFolders.includes(node.path);
      return (
        <div key={node.path}>
          <button
            type="button"
            onClick={() => toggleFolder(node.path)}
            className="w-full text-left text-xs rounded-lg px-2 py-1.5 bg-white/[0.03] border border-white/5 flex items-center gap-1.5"
            style={{ paddingLeft: `${8 + level * 14}px` }}
          >
            {opened ? <ChevronDown size={12} className="text-zinc-400" /> : <ChevronRight size={12} className="text-zinc-400" />}
            <FolderOpen size={12} className="text-brand-light" />
            <span className="text-zinc-200">{node.name}</span>
          </button>
          {opened && node.children && <div className="mt-1 space-y-1">{renderRepoTreeNodes(node.children, level + 1)}</div>}
        </div>
      );
    }

    return (
      <label
        key={node.path}
        className={`text-xs rounded-lg px-2 py-1.5 border flex items-start gap-2 ${activeFilePath === node.path ? 'border-brand/45 bg-brand/10' : 'bg-white/[0.03] border-white/5'}`}
        style={{ paddingLeft: `${8 + level * 14}px` }}
      >
        <input type="checkbox" checked={deletedPaths.includes(node.path)} onChange={() => toggleDeletePath(node.path)} className="mt-0.5" />
        <button type="button" onClick={() => loadFileContent(node.path)} className="flex items-start gap-1.5 flex-1 text-left">
          <FileText size={12} className="text-zinc-500 mt-0.5 shrink-0" />
          <span className="break-all text-zinc-300 flex-1">{node.name}</span>
        </button>
        <span className="text-[10px] text-zinc-500">{bytesToReadable(node.size || 0)}</span>
      </label>
    );
  });

  const renderRepoCards = (limit?: number) => {
    const rows = typeof limit === 'number' ? filteredProjects.slice(0, limit) : filteredProjects;
    if (rows.length === 0) return <div className="app-card p-6 text-center"><p className="text-xs text-zinc-500">Belum ada repository.</p></div>;

    return rows.map((project) => (
      <div key={project.id} className="app-card p-3 flex items-center justify-between gap-2">
        <button className="min-w-0 text-left" onClick={() => setSelectedProjectId(project.id || null)}>
          <p className="text-sm text-white font-semibold truncate">{project.repoName}</p>
          <p className="text-[11px] text-zinc-500">Update: {new Date(project.updatedAt).toLocaleString('id-ID')}</p>
        </button>
        <div className="flex items-center gap-1.5">
          <button onClick={() => project.id && copyToClipboard(project.url, project.id)} className="icon-btn" title="Salin URL">
            {copiedId === project.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          </button>
          <a href={project.url} target="_blank" className="icon-btn" title="Buka GitHub" rel="noreferrer"><ExternalLink size={14} /></a>
          <button onClick={() => deleteProject(project)} className="icon-btn hover:text-red-400" title="Hapus repo"><Trash2 size={14} /></button>
        </div>
      </div>
    ));
  };

  const renderDashboard = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="app-card p-3"><p className="text-[11px] text-zinc-500">Total Repo</p><p className="text-xl font-bold text-white mt-1">{projects.length}</p></div>
        <div className="app-card p-3"><p className="text-[11px] text-zinc-500">Aktivitas 7 Hari</p><p className="text-xl font-bold text-white mt-1">{totalWeekActivity}</p></div>
        <div className="app-card p-3"><p className="text-[11px] text-zinc-500">File Dipilih</p><p className="text-xl font-bold text-white mt-1">{selectedEntries.length}</p></div>
        <div className="app-card p-3"><p className="text-[11px] text-zinc-500">Ukuran Upload</p><p className="text-base font-bold text-white mt-1">{bytesToReadable(selectedTotalSize)}</p></div>
      </div>

      <div className="app-card p-3.5">
        <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-white">Grafik Aktivitas Push</h3><BarChart3 size={14} className="text-brand" /></div>
        <div className="flex items-end gap-2 h-28">
          {activityData.map((item) => (
            <div key={item.label} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-md bg-white/[0.04] h-20 flex items-end p-1"><div className="w-full rounded-[6px] bg-gradient-to-t from-brand to-brand-light" style={{ height: `${Math.max(8, (item.count / maxActivity) * 100)}%` }} /></div>
              <span className="text-[10px] text-zinc-500">{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="app-card p-3.5 space-y-2">
        <h3 className="text-sm font-semibold text-white">Riwayat Aktivitas</h3>
        <div className="space-y-1.5 max-h-40 overflow-auto pr-1">
          {logs.length === 0 && <p className="text-xs text-zinc-500">Belum ada log.</p>}
          {logs.slice(0, 10).map((log) => <p key={log.id} className="text-xs text-zinc-300 break-words">[{new Date(log.createdAt).toLocaleString('id-ID')}] {log.repoName}: {log.detail}</p>)}
        </div>
      </div>

      <div className="app-card p-3.5 space-y-2"><div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">Repository Terbaru</h3><button onClick={() => setTab('tools')} className="text-xs text-brand-light">Kelola di Tools</button></div><div className="space-y-2">{renderRepoCards(3)}</div></div>
    </div>
  );

  const renderUpload = () => (
    <div className="space-y-3">
      <section className="app-card p-3.5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg bg-brand/15 flex items-center justify-center"><Key size={15} className="text-brand-light" /></div><h3 className="text-sm font-semibold text-white">Akses GitHub</h3></div>
          {user && <button onClick={handleLogout} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-red-500/10 text-red-300">Putuskan</button>}
        </div>

        {!user ? (
          <div className="space-y-3">
            <p className="text-xs text-zinc-300">Apakah Anda sudah memiliki akun GitHub?</p>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setHasGithubAccount('yes')} className={`text-xs py-2 rounded-lg border ${hasGithubAccount === 'yes' ? 'bg-brand/20 border-brand/50 text-brand-light' : 'border-white/10 text-zinc-300'}`}>Sudah punya</button>
              <button onClick={() => setHasGithubAccount('no')} className={`text-xs py-2 rounded-lg border ${hasGithubAccount === 'no' ? 'bg-brand/20 border-brand/50 text-brand-light' : 'border-white/10 text-zinc-300'}`}>Belum punya</button>
            </div>
            {hasGithubAccount === 'no' && <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30"><p className="text-xs text-amber-100">Silakan daftar akun GitHub terlebih dahulu.</p><a href="https://github.com/signup" target="_blank" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-100" rel="noreferrer"><UserRoundPlus size={13} /> Daftar GitHub <ExternalLink size={13} /></a></div>}
            {hasGithubAccount === 'yes' && <><input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Masukkan Personal Access Token" className="input-modern text-sm" /><button onClick={() => validateToken(token)} className="btn-modern w-full text-sm py-2.5">Hubungkan Token</button><a href="https://github.com/settings/tokens/new?scopes=repo,delete_repo&description=RepoFlow_App" target="_blank" className="inline-flex items-center gap-2 text-xs text-zinc-400" rel="noreferrer"><ShieldCheck size={13} /> Buat token di GitHub</a></>}
          </div>
        ) : <div className="p-2.5 rounded-xl bg-brand/[0.08] border border-brand/25 flex items-center gap-2.5"><img src={user.avatarUrl} alt={user.username} className="w-8 h-8 rounded-lg" /><p className="text-xs text-zinc-200">Login sebagai <span className="font-semibold text-white">@{user.username}</span></p></div>}
      </section>

      <section className="app-card p-3.5 space-y-3">
        <h3 className="text-sm font-semibold text-white">Upload Multi-file / ZIP (dengan kontrol sebelum push)</h3>
        <input type="text" value={repoName} onChange={(e) => setRepoName(e.target.value.replace(/\s+/g, '-'))} placeholder="nama-repository" className="input-modern text-sm" />
        {repoCheckStatus === 'checking' && <p className="text-[11px] text-zinc-500">Memeriksa nama repo...</p>}
        {repoCheckStatus === 'available' && <p className="text-[11px] text-green-400">Nama repo tersedia.</p>}
        {repoCheckStatus === 'exists' && <p className="text-[11px] text-red-400">Nama repo sudah dipakai.</p>}

        <div onClick={() => !isDeploying && fileInputRef.current?.click()} className={`rounded-xl border border-dashed p-4 text-center ${pickedFileNames.length ? 'border-brand/40 bg-brand/[0.05]' : 'border-white/12 bg-white/[0.02]'}`}>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" multiple />
          <input type="file" ref={folderInputRef} onChange={handleFileChange} className="hidden" multiple {...({ webkitdirectory: 'true', directory: 'true' } as any)} />
          {pickedFileNames.length > 0 ? <div className="space-y-1.5"><FileArchive size={18} className="mx-auto text-brand-light" /><p className="text-xs text-white">{pickedFileNames.length} file terpilih</p></div> : <div className="space-y-1.5"><Upload size={18} className="mx-auto text-zinc-500" /><p className="text-xs text-zinc-300">Pilih banyak file sekaligus atau file ZIP</p></div>}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => fileInputRef.current?.click()} className="btn-modern text-xs py-2"><Upload size={13} /> Pilih File</button>
          <button onClick={() => folderInputRef.current?.click()} className="btn-modern text-xs py-2"><FileArchive size={13} /> Pilih Folder</button>
        </div>

        {isExtracting && <div className="space-y-1.5"><p className="text-xs text-zinc-300 flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" /> Ekstrak & analisis file...</p><div className="h-2 rounded-full bg-white/[0.05] overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-brand to-brand-light" initial={{ width: 0 }} animate={{ width: `${extractProgress}%` }} /></div></div>}

        <AnimatePresence>
          {uploadEntries.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="rounded-xl border border-white/10 bg-black/20 p-2.5">
              <div className="flex items-center justify-between mb-2"><p className="text-xs text-zinc-300">Preview ekstrak ({selectedEntries.length}/{uploadEntries.length})</p><p className="text-[11px] text-zinc-500">{bytesToReadable(selectedTotalSize)}</p></div>
              <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                {uploadEntries.map((entry) => (
                  <label key={entry.id} className="flex items-start gap-2 text-xs rounded-lg px-2 py-1.5 bg-white/[0.03] border border-white/5">
                    <input type="checkbox" checked={entry.include} onChange={() => toggleUploadEntry(entry.id)} className="mt-0.5" />
                    <FileJson size={13} className="text-zinc-500 shrink-0 mt-0.5" />
                    <span className="text-zinc-300 break-all flex-1" title={entry.path}>{entry.path}</span>
                    <span className="text-[10px] text-zinc-500 ml-auto shrink-0">{bytesToReadable(entry.size)}</span>
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button onClick={deployRepo} disabled={isDeploying || !user || !repoName || repoCheckStatus === 'exists' || selectedEntries.length === 0} className="btn-modern w-full text-sm py-2.5">{isDeploying ? <><Loader2 size={15} className="animate-spin" /> {status}</> : <><Rocket size={15} /> Push repo baru ke GitHub</>}</button>

        {isDeploying && <div className="space-y-1.5"><div className="flex justify-between text-[11px] text-zinc-500"><span>Progress Push</span><span>{Math.round(progress)}%</span></div><div className="h-2 rounded-full bg-white/[0.05] overflow-hidden"><motion.div className="h-full bg-gradient-to-r from-brand to-brand-light" initial={{ width: 0 }} animate={{ width: `${progress}%` }} /></div></div>}
      </section>
    </div>
  );

  const renderTools = () => (
    <div className="space-y-3">
      <section className="app-card p-3.5 space-y-2.5">
        <h3 className="text-sm font-semibold text-white">Control Repository (real-time sync, tambah/hapus file)</h3>
        <div className="grid md:grid-cols-3 gap-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
            <p className="text-xs font-semibold text-white">1) Pilih repo</p>
            <p className="text-[11px] text-zinc-400 mt-1">Cari repo lalu klik namanya untuk buka kontrol file lengkap.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
            <p className="text-xs font-semibold text-white">2) Atur perubahan</p>
            <p className="text-[11px] text-zinc-400 mt-1">Centang file untuk dihapus, lalu upload banyak file/folder untuk update.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-2.5">
            <p className="text-xs font-semibold text-white">3) Simpan aman</p>
            <p className="text-[11px] text-zinc-400 mt-1">Sistem cek konflik dulu agar edit manual di GitHub tidak tertimpa.</p>
          </div>
        </div>
        <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" /><input type="text" value={searchProject} onChange={(e) => setSearchProject(e.target.value)} placeholder="Cari repository" className="input-modern pl-9 text-sm" /></div>
      </section>
      <section className="space-y-2">{renderRepoCards()}</section>

      {selectedProject && (
        <section className="app-card p-3.5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">{selectedProject.repoName}</p>
              <p className="text-[11px] text-zinc-500">Terakhir sinkron: {selectedProject.lastSyncedAt ? new Date(selectedProject.lastSyncedAt).toLocaleString('id-ID') : '-'}</p>
            </div>
            <button onClick={() => syncSelectedRepo()} className="icon-btn" disabled={syncingRepo}>{syncingRepo ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}</button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <p className="text-xs text-zinc-300">Struktur file repo (klik file untuk lihat isi, centang untuk hapus)</p>
              <div className="max-h-56 overflow-y-auto pr-1 space-y-1.5">
                {repoFiles.length === 0 && <p className="text-[11px] text-zinc-500">Belum ada file (atau sedang sinkronisasi).</p>}
                {renderRepoTreeNodes(repoTree)}
              </div>
              <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
                <p className="text-[11px] text-zinc-400 mb-1">Isi file terpilih</p>
                {!activeFilePath && <p className="text-xs text-zinc-500">Belum ada file dipilih.</p>}
                {activeFilePath && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-zinc-300 break-all">{activeFilePath}</p>
                    <pre className="text-[11px] text-zinc-200 bg-zinc-950/70 border border-white/10 rounded-lg p-2 max-h-44 overflow-auto whitespace-pre-wrap break-words">
                      {activeFileLoading ? 'Memuat isi file...' : activeFileContent || 'File kosong.'}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-zinc-300">Tambahkan / update file (mendukung multi upload)</p>
              <input value={folderPrefix} onChange={(e) => setFolderPrefix(e.target.value)} placeholder="Folder tujuan (opsional), contoh: src/components" className="input-modern text-xs" />
              {repoFolders.length > 0 && (
                <select value={folderPrefix} onChange={(e) => setFolderPrefix(e.target.value)} className="input-modern text-xs">
                  <option value="">Root repository</option>
                  {repoFolders.map((folder) => <option key={folder} value={folder}>{folder}</option>)}
                </select>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => updateInputRef.current?.click()} className="btn-modern w-full text-xs py-2"><Upload size={14} /> Pilih file</button>
                <button onClick={() => updateFolderInputRef.current?.click()} className="btn-modern w-full text-xs py-2"><FileArchive size={14} /> Pilih folder</button>
              </div>
              <input ref={updateInputRef} type="file" multiple className="hidden" onChange={handleStageFiles} />
              <input ref={updateFolderInputRef} type="file" multiple className="hidden" onChange={handleStageFiles} {...({ webkitdirectory: 'true', directory: 'true' } as any)} />
              <div className="max-h-44 overflow-y-auto pr-1 space-y-1.5">
                {stagedFiles.length === 0 && <p className="text-[11px] text-zinc-500">Belum ada file staging.</p>}
                {stagedFiles.map((file) => (
                  <div key={file.id} className="text-xs rounded-lg px-2 py-1.5 bg-white/[0.03] border border-white/5 flex items-start gap-2">
                    <FileCode2 size={12} className="mt-0.5 text-zinc-500" />
                    <span className="break-all text-zinc-300 flex-1">{file.path}</span>
                    <button className="icon-btn w-6 h-6 ml-auto" onClick={() => removeStagedFile(file.path)}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button onClick={applyRepoChanges} disabled={savingRepo || syncingRepo || (!stagedFiles.length && !deletedPaths.length)} className="btn-modern w-full text-sm py-2.5">
            {savingRepo ? <><Loader2 size={15} className="animate-spin" /> Menyimpan...</> : <><Save size={14} /> Simpan perubahan ke GitHub</>}
          </button>
        </section>
      )}
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
          RepoFlow adalah web untuk membuat repo baru, upload banyak file/folder/ZIP, kontrol file nested, dan update/hapus file ke GitHub dengan sinkronisasi berkala agar lebih aman dari bentrok perubahan.
        </p>
        <ul className="space-y-1 text-[11px] text-zinc-300">
          <li>• Upload multi-file + folder + ZIP dalam satu alur.</li>
          <li>• Kontrol penuh isi repo (lihat semua file root & folder, hapus, tambah, update).</li>
          <li>• Riwayat aktivitas dan waktu pembuatan/pembaruan repo tersimpan lokal.</li>
        </ul>
      </section>

      <section className="app-card p-3.5 space-y-2">
        <h3 className="text-sm font-semibold text-white">Informasi Dev</h3>
        <div className="flex items-center gap-3">
          <img src={DEV_PROFILE_IMAGE} alt="Developer profile" className="w-12 h-12 rounded-xl border border-white/15 object-cover" referrerPolicy="no-referrer" />
          <div>
            <p className="text-xs text-white font-semibold">Rahmat / rAi Engine</p>
            <p className="text-[11px] text-zinc-500">Maintainer & developer RepoFlow.</p>
          </div>
        </div>
      </section>

      <section className="app-card p-3.5 space-y-2">
        <h3 className="text-sm font-semibold text-white">Teknologi yang Dipakai</h3>
        <div className="grid md:grid-cols-2 gap-2 text-xs text-zinc-300">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">Bahasa: TypeScript, JavaScript, HTML, CSS.</div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">Frontend: React + Vite + Tailwind style utilities.</div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">Integrasi GitHub: Octokit REST API.</div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">Database lokal: IndexedDB (Dexie) untuk token, metadata, history.</div>
        </div>
      </section>

      <section className="app-card p-3.5 space-y-2">
        <h3 className="text-sm font-semibold text-white">Sosial Media Dev</h3>
        <div className="grid md:grid-cols-2 gap-2">
          {SOCIAL_LINKS.map((item) => (
            <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 bg-white/[0.02] px-2.5 py-2 text-xs text-zinc-300 flex items-center justify-between hover:border-brand/35 hover:text-white">
              <span>{item.label}</span>
              <ExternalLink size={13} />
            </a>
          ))}
        </div>
      </section>

      <section className="app-card p-3.5 space-y-2">
        <h3 className="text-sm font-semibold text-white">History & Catatan Update</h3>
        <div className="space-y-1.5 max-h-52 overflow-auto pr-1">
          {logs.length === 0 && <p className="text-xs text-zinc-500">Belum ada catatan update.</p>}
          {logs.map((log) => (
            <div key={log.id} className="rounded-lg border border-white/10 bg-white/[0.02] px-2.5 py-2">
              <p className="text-[11px] text-zinc-400">{new Date(log.createdAt).toLocaleString('id-ID')}</p>
              <p className="text-xs text-white mt-0.5">{log.repoName} · {formatActionLabel(log.action)}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5 break-words">{log.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  if (!hasStarted) {
    return (
      <div className="min-h-screen px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-md app-card p-5 space-y-4 text-center">
          <img src={WEB_ICON} alt="RepoFlow logo" className="w-12 h-12 rounded-2xl mx-auto border border-white/15" referrerPolicy="no-referrer" />
          <h1 className="text-xl font-bold text-white">Selamat Datang di RepoFlow</h1>
          <p className="text-xs text-zinc-400 leading-relaxed">Aplikasi push project modern untuk upload ZIP/semua file ke GitHub, memantau aktivitas, dan mengelola repository dari HP maupun desktop.</p>
          <button onClick={startApp} className="btn-modern w-full text-sm py-2.5">Lanjutkan ke Aplikasi</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-[86px] md:pb-0">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-bg-dark/90 backdrop-blur-xl px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5"><img src={WEB_ICON} alt="RepoFlow logo" className="w-8 h-8 rounded-lg border border-white/15" referrerPolicy="no-referrer" /><div><p className="text-xs text-zinc-500">RepoFlow App</p><h1 className="text-sm text-white font-semibold">{tab === 'dashboard' && 'Dashboard'}{tab === 'upload' && 'Upload & Push Git'}{tab === 'tools' && 'Tools Repository'}{tab === 'info' && 'Info Website'}</h1></div></div>
          {user ? <div className="flex items-center gap-2"><Github size={14} className="text-zinc-400" /><span className="text-xs text-zinc-300">@{user.username}</span></div> : <span className="text-[11px] text-zinc-500">Belum terhubung</span>}
        </div>
      </header>

      <main className="px-3 py-3 md:px-6">
        <div className="max-w-6xl mx-auto md:grid md:grid-cols-[220px_1fr] md:gap-4">
          <aside className="hidden md:block app-card p-2 h-fit sticky top-[86px]">
            {NAV_ITEMS.map((item) => (
              <button key={item.id} onClick={() => setTab(item.id)} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs mb-1 ${tab === item.id ? 'text-brand-light bg-brand/10' : 'text-zinc-400 hover:bg-white/[0.04]'}`}>{item.icon}{item.label}</button>
            ))}
          </aside>

          <div>
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                {(error || success) && <div className={`mb-3 p-2.5 rounded-xl text-xs flex items-center gap-2 border ${error ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-green-500/10 border-green-500/20 text-green-300'}`}>{error ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />} {error || success}</div>}
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
            <button key={item.id} onClick={() => setTab(item.id)} className={`flex flex-col items-center justify-center gap-1 py-2 rounded-lg text-[10px] ${tab === item.id ? 'text-brand-light bg-brand/10' : 'text-zinc-400'}`}>{item.icon}{item.label}</button>
          ))}
        </div>
      </nav>
    </div>
  );
}
