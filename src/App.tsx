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
  Github,
  Home,
  Info,
  Key,
  Loader2,
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
import { db, type GitHubToken, type Project } from './lib/db';

type AppTab = 'dashboard' | 'upload' | 'tools' | 'info';

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

    const count = projects.filter((project) => project.createdAt >= dayStart.getTime() && project.createdAt <= dayEnd.getTime()).length;

    return {
      label: labels[date.getDay()],
      count,
    };
  });
};

export default function App() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<GitHubToken | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [repoName, setRepoName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
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

  useEffect(() => {
    loadUserData();
    loadProjects();
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
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [repoName, user]);

  const filteredProjects = useMemo(
    () => projects.filter((project) => project.repoName.toLowerCase().includes(searchProject.toLowerCase())),
    [projects, searchProject],
  );

  const activityData = useMemo(() => getRecentActivity(projects), [projects]);
  const totalWeekActivity = activityData.reduce((acc, curr) => acc + curr.count, 0);
  const maxActivity = Math.max(1, ...activityData.map((item) => item.count));

  const loadUserData = async () => {
    const savedTokens = await db.tokens.toArray();
    if (savedTokens.length > 0) {
      setUser(savedTokens[0]);
      setToken(savedTokens[0].token);
      setHasGithubAccount('yes');
    }
  };

  const loadProjects = async () => {
    const savedProjects = await db.projects.orderBy('createdAt').reverse().toArray();
    setProjects(savedProjects);
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
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isZip = file.name.toLowerCase().endsWith('.zip');
    const isHtml = file.name.toLowerCase().endsWith('.html');

    if (!isZip && !isHtml) {
      setError('File harus format .zip atau .html.');
      return;
    }

    setUploadFile(file);
    setError(null);
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const deployRepo = async () => {
    if (!user || !uploadFile || !repoName.trim()) {
      setError('Lengkapi nama repository dan file upload dulu.');
      return;
    }

    if (repoCheckStatus === 'exists') {
      setError('Nama repository sudah dipakai. Gunakan nama lain.');
      return;
    }

    setIsDeploying(true);
    setError(null);
    setProgress(8);
    setStatus('Membuat repository...');

    try {
      const octokit = new Octokit({ auth: user.token });
      const finalRepo = repoName.trim();

      const { data: repo } = await octokit.repos.createForAuthenticatedUser({
        name: finalRepo,
        auto_init: false,
      });
      setProgress(28);

      if (uploadFile.name.toLowerCase().endsWith('.zip')) {
        setStatus('Membaca ZIP & upload file...');
        const zip = new JSZip();
        const content = await zip.loadAsync(uploadFile);
        const files = Object.keys(content.files).filter((path) => !content.files[path].dir);

        for (let i = 0; i < files.length; i += 1) {
          const filePath = files[i];
          const fileContent = await content.files[filePath].async('base64');
          await octokit.repos.createOrUpdateFileContents({
            owner: user.username,
            repo: finalRepo,
            path: filePath,
            message: `Initial commit: ${filePath}`,
            content: fileContent,
          });
          setProgress(28 + ((i + 1) / files.length) * 62);
          setStatus(`Mengunggah ${i + 1}/${files.length}`);
        }
      } else {
        setStatus('Upload file HTML...');
        const htmlContent = await uploadFile.text();
        await octokit.repos.createOrUpdateFileContents({
          owner: user.username,
          repo: finalRepo,
          path: 'index.html',
          message: 'Initial commit: index.html',
          content: btoa(unescape(encodeURIComponent(htmlContent))),
        });
        setProgress(92);
      }

      const newProject: Project = {
        repoName: finalRepo,
        owner: user.username,
        url: repo.html_url,
        createdAt: Date.now(),
      };

      await db.projects.add(newProject);
      await loadProjects();

      setProgress(100);
      setStatus('Selesai.');
      setSuccess(`Deploy ${finalRepo} berhasil.`);
      setRepoName('');
      setUploadFile(null);
      setRepoCheckStatus('idle');

      setTimeout(() => {
        setIsDeploying(false);
        setSuccess(null);
        setStatus('');
        setProgress(0);
      }, 2000);
    } catch (err: any) {
      setError(`Deploy gagal: ${err?.message || 'Terjadi kesalahan.'}`);
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

  const renderDashboard = () => (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="app-card p-3">
          <p className="text-[11px] text-zinc-500">Total Repo</p>
          <p className="text-xl font-bold text-white mt-1">{projects.length}</p>
        </div>
        <div className="app-card p-3">
          <p className="text-[11px] text-zinc-500">Aktivitas 7 Hari</p>
          <p className="text-xl font-bold text-white mt-1">{totalWeekActivity}</p>
        </div>
      </div>

      <div className="app-card p-3.5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Grafik Aktivitas Deploy</h3>
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

      <div className="app-card p-3.5">
        <h3 className="text-sm font-semibold text-white mb-2">Selamat datang di aplikasi</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Gunakan tab Upload untuk deploy ZIP/HTML, tab Tools untuk kelola repo, dan tab Info Web untuk melihat profil developer serta link komunitas.
        </p>
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
                <a href="https://github.com/signup" target="_blank" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-amber-100">
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
        <h3 className="text-sm font-semibold text-white">Upload ZIP / HTML</h3>
        <input
          type="text"
          value={repoName}
          onChange={(e) => setRepoName(e.target.value.replace(/\s+/g, '-'))}
          placeholder="nama-repository"
          className="input-modern text-sm"
        />

        {repoCheckStatus === 'checking' && <p className="text-[11px] text-zinc-500">Memeriksa nama repo...</p>}
        {repoCheckStatus === 'available' && <p className="text-[11px] text-green-400">Nama repo tersedia.</p>}
        {repoCheckStatus === 'exists' && <p className="text-[11px] text-red-400">Nama repo sudah dipakai.</p>}

        <div
          onClick={() => !isDeploying && fileInputRef.current?.click()}
          className={`rounded-xl border border-dashed p-4 text-center ${uploadFile ? 'border-brand/40 bg-brand/[0.05]' : 'border-white/12 bg-white/[0.02]'}`}
        >
          <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".zip,.html" />
          {uploadFile ? (
            <div className="space-y-1.5">
              {uploadFile.name.toLowerCase().endsWith('.zip') ? <FileArchive size={18} className="mx-auto text-brand-light" /> : <FileCode2 size={18} className="mx-auto text-brand-light" />}
              <p className="text-xs text-white break-all">{uploadFile.name}</p>
              <p className="text-[11px] text-zinc-500">{(uploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Upload size={18} className="mx-auto text-zinc-500" />
              <p className="text-xs text-zinc-300">Pilih file .zip atau .html</p>
            </div>
          )}
        </div>

        <button
          onClick={deployRepo}
          disabled={isDeploying || !user || !uploadFile || !repoName || repoCheckStatus === 'exists'}
          className="btn-modern w-full text-sm py-2.5"
        >
          {isDeploying ? <><Loader2 size={15} className="animate-spin" /> {status}</> : <><Rocket size={15} /> Deploy Sekarang</>}
        </button>

        {isDeploying && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-[11px] text-zinc-500">
              <span>Progress</span>
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

      <section className="space-y-2">
        {filteredProjects.length > 0 ? (
          filteredProjects.map((project) => (
            <div key={project.id} className="app-card p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm text-white font-semibold truncate">{project.repoName}</p>
                <p className="text-[11px] text-zinc-500">{new Date(project.createdAt).toLocaleDateString('id-ID')}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => project.id && copyToClipboard(project.url, project.id)} className="icon-btn" title="Salin URL">
                  {copiedId === project.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                </button>
                <a href={project.url} target="_blank" className="icon-btn" title="Buka GitHub">
                  <ExternalLink size={14} />
                </a>
                <button onClick={() => deleteProject(project)} className="icon-btn hover:text-red-400" title="Hapus repo">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="app-card p-6 text-center">
            <p className="text-xs text-zinc-500">Belum ada repository.</p>
          </div>
        )}
      </section>
    </div>
  );

  const renderInfo = () => (
    <div className="space-y-3">
      <section className="app-card p-3.5 space-y-2">
        <h3 className="text-sm font-semibold text-white">Tentang Website</h3>
        <p className="text-xs text-zinc-400 leading-relaxed">
          RepoFlow adalah web app untuk mempercepat deploy proyek dengan upload ZIP/HTML langsung ke GitHub. Fokus utama: cepat, ringan, dan nyaman di HP.
        </p>
      </section>

      <section className="app-card p-3.5 space-y-2">
        <h3 className="text-sm font-semibold text-white">Tentang Developer</h3>
        <div className="flex items-center gap-2.5">
          <img
            src="https://res.cloudinary.com/dwiozm4vz/image/upload/v1772959730/ootglrvfmykn6xsto7rq.png"
            alt="R_hmt ofc"
            className="w-10 h-10 rounded-xl border border-white/10"
            referrerPolicy="no-referrer"
          />
          <div>
            <p className="text-sm font-semibold text-white">R_hmt ofc</p>
            <p className="text-[11px] text-zinc-500">Lead Developer & AI Architect</p>
          </div>
        </div>
      </section>

      <section className="app-card p-3.5 space-y-2">
        <h3 className="text-sm font-semibold text-white">Komunitas & Sosial Media</h3>
        <div className="grid grid-cols-1 gap-2">
          <a href="https://whatsapp.com/channel/0029VbBjyjlJ93wa6hwSWa0p" target="_blank" className="link-item">
            Join Saluran WhatsApp <ExternalLink size={13} />
          </a>
          <a href="https://www.instagram.com/rahmt_nhw?igsh=MWQwcnB3bTA2ZnVidg==" target="_blank" className="link-item">
            Instagram Developer <ExternalLink size={13} />
          </a>
          <a href="https://www.tiktok.com/@r_hmtofc?_r=1&_t=ZS-94KRfWQjeUu" target="_blank" className="link-item">
            TikTok Developer <ExternalLink size={13} />
          </a>
          <a href="https://t.me/rAi_engine" target="_blank" className="link-item">
            Telegram Channel <ExternalLink size={13} />
          </a>
        </div>
      </section>
    </div>
  );

  if (!hasStarted) {
    return (
      <div className="min-h-screen px-4 py-8 flex items-center justify-center">
        <div className="w-full max-w-md app-card p-5 space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-brand/20 flex items-center justify-center mx-auto">
            <Code2 size={20} className="text-brand-light" />
          </div>
          <h1 className="text-xl font-bold text-white">Selamat Datang di RepoFlow</h1>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Aplikasi deploy modern gaya native untuk upload ZIP/HTML ke GitHub, memantau aktivitas, dan mengelola repository Anda dari HP dengan nyaman.
          </p>
          <button onClick={startApp} className="btn-modern w-full text-sm py-2.5">
            Lanjutkan ke Aplikasi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-[86px]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-bg-dark/90 backdrop-blur-xl px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500">RepoFlow App</p>
            <h1 className="text-sm text-white font-semibold">
              {tab === 'dashboard' && 'Dashboard'}
              {tab === 'upload' && 'Upload & Deploy'}
              {tab === 'tools' && 'Tools Repository'}
              {tab === 'info' && 'Info Website'}
            </h1>
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

      <main className="px-3 py-3">
        <div className="max-w-xl mx-auto">
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
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl z-50 pb-[calc(0.35rem+env(safe-area-inset-bottom))]">
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
