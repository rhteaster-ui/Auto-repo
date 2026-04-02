/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Github,
  Instagram,
  Send,
  ExternalLink,
  Key,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileArchive,
  ChevronRight,
  ShieldCheck,
  Zap,
  Layers,
  Globe,
  Code2,
  Copy,
  Check,
  Search,
  Sparkles,
  UserRoundPlus,
  Rocket,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { Octokit } from '@octokit/rest';
import { db, type GitHubToken, type Project } from './lib/db';

const WhatsAppIcon = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12.011 0C5.384 0 0 5.383 0 12.01c0 2.116.547 4.178 1.588 6.005L.057 24l6.137-1.613a11.96 11.96 0 0 0 5.817 1.503c6.628 0 12.011-5.383 12.011-12.01C24.022 5.383 18.639 0 12.011 0zm0 21.993a9.946 9.946 0 0 1-5.076-1.387l-.364-.216-3.774.99.99-3.675-.237-.377a9.944 9.944 0 0 1-1.517-5.318c0-5.51 4.482-9.992 9.992-9.992 2.67 0 5.18 1.04 7.07 2.93a9.944 9.944 0 0 1 2.92 7.062c0 5.51-4.482 9.992-9.992 9.992zm5.488-7.534c-.3-.15-1.774-.875-2.048-.975-.275-.1-.475-.15-.675.15-.2.3-.775 1-.95 1.2-.175.2-.35.225-.65.075-.3-.15-1.265-.465-2.41-1.485-.89-.795-1.49-1.775-1.665-2.075-.175-.3-.02-.46.13-.61.135-.135.3-.35.45-.525.15-.175.2-.3.3-.5s.05-.375-.025-.525c-.075-.15-.675-1.625-.925-2.225-.244-.588-.49-.508-.675-.518-.175-.008-.375-.01-.575-.01-.2 0-.525.075-.8.375-.275.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.11 3.225 5.115 4.525.715.31 1.27.5 1.705.64.715.23 1.365.2 1.88.12.575-.085 1.775-.725 2.025-1.425.25-.7.25-1.3 1.175-1.425-.075-.125-.275-.2-.575-.35z" />
  </svg>
);

const TikTokIcon = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.89 2.89 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1 .05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const VercelIcon = ({ size = 24, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 22.525H0L12 1.475L24 22.525Z" />
  </svg>
);

export default function App() {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<GitHubToken | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [repoName, setRepoName] = useState('');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [status, setStatus] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [hasGithubAccount, setHasGithubAccount] = useState<'yes' | 'no' | null>(null);
  const [searchProject, setSearchProject] = useState('');
  const [repoCheckStatus, setRepoCheckStatus] = useState<'idle' | 'checking' | 'available' | 'exists'>('idle');

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
        if (err?.status === 404) {
          setRepoCheckStatus('available');
        } else {
          setRepoCheckStatus('idle');
        }
      }
    }, 600);

    return () => clearTimeout(timeoutId);
  }, [repoName, user]);

  const filteredProjects = projects.filter((project) =>
    project.repoName.toLowerCase().includes(searchProject.toLowerCase()),
  );

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
      setSuccess('Token GitHub berhasil divalidasi.');
      setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      setError('Token tidak valid atau koneksi bermasalah. Coba lagi.');
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
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Format file harus .zip.');
      return;
    }

    setZipFile(file);
    setError(null);
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const deployRepo = async () => {
    if (!user || !zipFile || !repoName.trim()) {
      setError('Lengkapi nama repository dan file ZIP terlebih dahulu.');
      return;
    }

    if (repoCheckStatus === 'exists') {
      setError('Nama repository sudah dipakai. Silakan gunakan nama lain.');
      return;
    }

    setIsDeploying(true);
    setStatus('Membaca file ZIP...');
    setProgress(10);
    setError(null);

    try {
      const octokit = new Octokit({ auth: user.token });

      setStatus('Membuat repository baru...');
      const { data: repo } = await octokit.repos.createForAuthenticatedUser({
        name: repoName.trim(),
        auto_init: false,
      });
      setProgress(30);

      const zip = new JSZip();
      const content = await zip.loadAsync(zipFile);
      const files = Object.keys(content.files).filter((path) => !content.files[path].dir);

      for (let i = 0; i < files.length; i += 1) {
        const filePath = files[i];
        const fileContent = await content.files[filePath].async('base64');

        setStatus(`Mengunggah ${i + 1}/${files.length}: ${filePath}`);
        await octokit.repos.createOrUpdateFileContents({
          owner: user.username,
          repo: repoName.trim(),
          path: filePath,
          message: `Initial commit: ${filePath}`,
          content: fileContent,
        });

        setProgress(30 + ((i + 1) / files.length) * 60);
      }

      const newProject: Project = {
        repoName: repoName.trim(),
        owner: user.username,
        url: repo.html_url,
        createdAt: Date.now(),
      };

      await db.projects.add(newProject);
      await loadProjects();

      setProgress(100);
      setStatus('Selesai. Repository berhasil dibuat.');
      setSuccess(`Berhasil deploy ke ${repoName.trim()}.`);
      setRepoName('');
      setZipFile(null);
      setRepoCheckStatus('idle');

      setTimeout(() => {
        setIsDeploying(false);
        setSuccess(null);
        setStatus('');
        setProgress(0);
      }, 2500);
    } catch (err: any) {
      setError(`Deploy gagal: ${err?.message || 'Terjadi kesalahan.'}`);
      setIsDeploying(false);
    }
  };

  const deleteProject = async (project: Project) => {
    if (!user) return;

    const isConfirm = window.confirm(`Hapus repository "${project.repoName}" dari GitHub?`);
    if (!isConfirm) return;

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

  return (
    <div className="min-h-screen flex flex-col selection:bg-brand/30">
      <section className="relative pt-16 md:pt-20 pb-10 px-4 md:px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-brand/10 blur-[120px] rounded-full -z-10 opacity-60" />

        <div className="max-w-4xl mx-auto text-center space-y-5">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-light"
          >
            <Sparkles size={12} className="text-brand" />
            <span>UI baru • lebih ringkas • mobile friendly</span>
          </motion.div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white">
            Repo<span className="brand-gradient">Flow</span>
          </h1>

          <p className="text-sm md:text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed font-medium">
            Upload ZIP, deploy ke GitHub otomatis, lalu pantau riwayat project dalam satu dashboard modern berbahasa Indonesia.
          </p>
        </div>
      </section>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 md:px-6 space-y-6 md:space-y-8 pb-24 md:pb-16">
        <AnimatePresence>
          {(error || success) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`p-4 rounded-2xl flex items-center gap-3 border backdrop-blur-xl ${
                error ? 'bg-red-500/10 border-red-500/20 text-red-300' : 'bg-green-500/10 border-green-500/20 text-green-300'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${error ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              </div>
              <p className="text-sm font-semibold">{error || success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <section id="akun" className="glass-card glow-border p-5 md:p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
                <Key className="text-brand" size={18} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Akses GitHub</h3>
                <p className="text-xs text-zinc-500">Hubungkan akun sebelum deploy</p>
              </div>
            </div>
            {user && (
              <button onClick={handleLogout} className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-300 text-xs font-bold hover:bg-red-500/20">
                Putuskan
              </button>
            )}
          </div>

          {!user && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                <p className="text-sm font-semibold text-zinc-200 mb-3">Apakah Anda sudah punya akun GitHub?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setHasGithubAccount('yes')}
                    className={`px-3 py-2 rounded-xl text-sm font-bold border transition ${
                      hasGithubAccount === 'yes' ? 'bg-brand/20 border-brand/40 text-brand-light' : 'bg-white/[0.02] border-white/10 text-zinc-300'
                    }`}
                  >
                    Sudah punya
                  </button>
                  <button
                    onClick={() => setHasGithubAccount('no')}
                    className={`px-3 py-2 rounded-xl text-sm font-bold border transition ${
                      hasGithubAccount === 'no' ? 'bg-brand/20 border-brand/40 text-brand-light' : 'bg-white/[0.02] border-white/10 text-zinc-300'
                    }`}
                  >
                    Belum punya
                  </button>
                </div>
              </div>

              {hasGithubAccount === 'no' && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-100 text-sm space-y-3">
                  <p className="font-semibold">Silakan daftar GitHub terlebih dahulu.</p>
                  <a
                    href="https://github.com/signup"
                    target="_blank"
                    className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg bg-amber-400/20 hover:bg-amber-400/30"
                  >
                    <UserRoundPlus size={14} /> Daftar GitHub <ExternalLink size={14} />
                  </a>
                </div>
              )}

              {hasGithubAccount === 'yes' && (
                <>
                  <div className="flex flex-col md:flex-row gap-3">
                    <input
                      type="password"
                      placeholder="Masukkan GitHub Personal Access Token"
                      className="input-modern"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                    />
                    <button onClick={() => validateToken(token)} className="btn-modern md:w-44 h-[50px] text-sm">
                      Hubungkan
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/[0.05] space-y-2">
                      <div className="flex items-center gap-2 text-zinc-200 font-semibold text-sm">
                        <ShieldCheck size={16} className="text-brand" />
                        <span>Panduan Singkat</span>
                      </div>
                      <p className="text-xs text-zinc-500">Buat token dengan akses repo dan delete_repo lalu tempel di kolom di atas.</p>
                    </div>
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo,delete_repo&description=RepoFlow_App"
                      target="_blank"
                      className="flex items-center justify-between p-4 bg-white/[0.02] rounded-2xl border border-white/[0.05] hover:bg-white/[0.05]"
                    >
                      <div>
                        <span className="text-sm font-bold text-zinc-200 block">Buat Token</span>
                        <span className="text-[11px] text-zinc-500">Buka GitHub Settings</span>
                      </div>
                      <ChevronRight size={18} className="text-zinc-500" />
                    </a>
                  </div>
                </>
              )}
            </div>
          )}

          {user && (
            <div className="flex items-center gap-4 p-4 bg-brand/[0.05] rounded-2xl border border-brand/20">
              <img src={user.avatarUrl} alt={user.username} className="w-12 h-12 rounded-xl border border-brand/40" />
              <div>
                <p className="text-xs text-zinc-500">Akun aktif</p>
                <p className="text-lg font-bold text-white">@{user.username}</p>
              </div>
            </div>
          )}
        </section>

        <section id="deploy" className="glass-card glow-border p-5 md:p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <Layers className="text-brand" size={18} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Deploy Engine</h3>
              <p className="text-xs text-zinc-500">Upload ZIP dan deploy ke repository baru</p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-zinc-500">Nama Repository</label>
            <input
              type="text"
              placeholder="contoh: website-company-profile"
              className="input-modern"
              value={repoName}
              onChange={(e) => setRepoName(e.target.value.replace(/\s+/g, '-'))}
              disabled={isDeploying}
            />
            {repoCheckStatus === 'checking' && <p className="text-xs text-zinc-500">Memeriksa ketersediaan nama repository...</p>}
            {repoCheckStatus === 'available' && <p className="text-xs text-green-400">Nama repository tersedia.</p>}
            {repoCheckStatus === 'exists' && <p className="text-xs text-red-400">Nama repository sudah ada di akun Anda.</p>}
          </div>

          <div
            onClick={() => !isDeploying && fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isDeploying) return;
              const file = e.dataTransfer.files[0];
              if (file?.name.toLowerCase().endsWith('.zip')) {
                setZipFile(file);
                setError(null);
              } else {
                setError('Format file harus .zip.');
              }
            }}
            className={`border-2 border-dashed rounded-2xl p-8 md:p-10 text-center transition-all ${
              zipFile ? 'border-brand bg-brand/[0.05]' : 'border-white/[0.08] hover:border-brand/40 bg-white/[0.02]'
            }`}
          >
            <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".zip" />

            {zipFile ? (
              <div className="space-y-3">
                <div className="w-14 h-14 bg-brand/20 rounded-2xl flex items-center justify-center mx-auto">
                  <FileArchive size={28} className="text-brand" />
                </div>
                <p className="font-bold text-white break-all">{zipFile.name}</p>
                <p className="text-xs text-zinc-500">{(zipFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="w-14 h-14 bg-white/[0.04] rounded-2xl flex items-center justify-center mx-auto">
                  <Upload size={28} className="text-zinc-500" />
                </div>
                <p className="font-semibold text-zinc-300">Tarik file ZIP ke sini</p>
                <p className="text-xs text-zinc-500">atau klik untuk memilih dari perangkat</p>
              </div>
            )}
          </div>

          <button
            onClick={deployRepo}
            disabled={isDeploying || !user || !zipFile || !repoName || repoCheckStatus === 'exists'}
            className="w-full btn-modern py-3.5 text-sm md:text-base shadow-xl shadow-brand/20"
          >
            {isDeploying ? (
              <>
                <Loader2 className="animate-spin" size={18} /> {status}
              </>
            ) : (
              <>
                <Rocket size={18} /> Mulai Deploy
              </>
            )}
          </button>

          {isDeploying && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-500">
                <span>Progress Deploy</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="h-2.5 bg-white/[0.04] rounded-full overflow-hidden">
                <motion.div className="h-full bg-gradient-to-r from-brand to-brand-light" initial={{ width: 0 }} animate={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </section>

        <section id="riwayat" className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <Code2 className="text-brand" size={20} />
              <h3 className="font-bold text-lg text-white">Riwayat Repository</h3>
            </div>
            <span className="px-3 py-1 bg-white/[0.04] border border-white/[0.06] rounded-full text-[11px] font-semibold text-zinc-400 w-fit">
              {projects.length} repository
            </span>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Cari nama repository..."
              value={searchProject}
              onChange={(e) => setSearchProject(e.target.value)}
              className="input-modern pl-10"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredProjects.length > 0 ? (
              filteredProjects.map((project) => (
                <motion.div key={project.id} layout className="glass-card p-4 flex items-center justify-between group border-white/[0.06]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-white/[0.04] rounded-xl flex items-center justify-center">
                      <Github className="text-zinc-500" size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-zinc-100 truncate">{project.repoName}</h4>
                      <p className="text-[11px] text-zinc-500">{new Date(project.createdAt).toLocaleDateString('id-ID')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => project.id && copyToClipboard(project.url, project.id)}
                      className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white"
                      title="Salin URL"
                    >
                      {copiedId === project.id ? <Check size={15} className="text-green-400" /> : <Copy size={15} />}
                    </button>
                    <a href={project.url} target="_blank" className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white" title="Buka GitHub">
                      <ExternalLink size={15} />
                    </a>
                    <button onClick={() => deleteProject(project)} className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 hover:text-red-400" title="Hapus repository">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-12 text-center space-y-3 bg-white/[0.01] rounded-2xl border border-dashed border-white/[0.08]">
                <Globe size={28} className="text-zinc-700 mx-auto" />
                <p className="text-zinc-500 font-semibold">Belum ada repository yang cocok.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-3 gap-2 text-xs">
          <a href="#akun" className="flex flex-col items-center gap-1 py-1.5 text-zinc-300">
            <Key size={16} /> Akun
          </a>
          <a href="#deploy" className="flex flex-col items-center gap-1 py-1.5 text-zinc-300">
            <Zap size={16} /> Deploy
          </a>
          <a href="#riwayat" className="flex flex-col items-center gap-1 py-1.5 text-zinc-300">
            <Code2 size={16} /> Riwayat
          </a>
        </div>
      </div>

      <footer className="bg-zinc-950 border-t border-white/[0.05] pt-12 md:pt-16 pb-24 md:pb-10 px-4 md:px-6 mt-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <motion.div whileHover={{ y: -3 }} className="glass-card p-5 flex flex-col md:flex-row items-center justify-between gap-4 border-whatsapp/30 bg-whatsapp/[0.05]">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-whatsapp/20 rounded-2xl flex items-center justify-center">
                <WhatsAppIcon size={30} className="text-whatsapp" />
              </div>
              <div className="text-center md:text-left">
                <h2 className="font-bold text-xl text-white">Komunitas Code & AI</h2>
                <p className="text-zinc-400 text-sm">Update tools & script terbaru setiap hari.</p>
              </div>
            </div>
            <a href="https://whatsapp.com/channel/0029VbBjyjlJ93wa6hwSWa0p" target="_blank" className="w-full md:w-auto px-5 py-3 bg-whatsapp hover:bg-whatsapp/90 text-black font-bold rounded-xl flex items-center justify-center gap-2 transition-all">
              Join Channel <ExternalLink size={16} />
            </a>
          </motion.div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pt-4 border-t border-white/[0.05]">
            <div className="flex items-center gap-4">
              <img
                src="https://res.cloudinary.com/dwiozm4vz/image/upload/v1772959730/ootglrvfmykn6xsto7rq.png"
                alt="R_hmt ofc"
                className="w-14 h-14 rounded-2xl border border-white/10"
                referrerPolicy="no-referrer"
              />
              <div>
                <h4 className="font-bold text-lg text-white tracking-tight">R_hmt ofc</h4>
                <p className="text-xs text-zinc-500">Lead Developer & AI Architect</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a href="https://www.instagram.com/rahmt_nhw?igsh=MWQwcnB3bTA2ZnVidg==" target="_blank" className="w-10 h-10 glass-card flex items-center justify-center hover:bg-white/10">
                <Instagram size={18} className="text-zinc-500" />
              </a>
              <a href="https://www.tiktok.com/@r_hmtofc?_r=1&_t=ZS-94KRfWQjeUu" target="_blank" className="w-10 h-10 glass-card flex items-center justify-center hover:bg-white/10">
                <TikTokIcon size={18} className="text-zinc-500" />
              </a>
              <a href="https://t.me/rAi_engine" target="_blank" className="w-10 h-10 glass-card flex items-center justify-center hover:bg-white/10">
                <Send size={18} className="text-zinc-500" />
              </a>
            </div>
          </div>

          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.05]">
              <VercelIcon size={14} className="text-white" />
              <span className="text-[11px] text-zinc-500">Optimized for Vercel Deployment</span>
            </div>
            <p className="text-xs text-zinc-700">© 2026 RepoFlow. Didesain ulang untuk performa & UX.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
