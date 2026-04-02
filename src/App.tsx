/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Github, 
  Instagram, 
  Send, 
  MessageCircle, 
  ExternalLink, 
  Key, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Plus,
  FileArchive,
  ChevronRight,
  ShieldCheck,
  Zap,
  Layers,
  Globe,
  Code2,
  Copy,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import { Octokit } from '@octokit/rest';
import { db, type GitHubToken, type Project } from './lib/db';

// Custom Brand Icons
const WhatsAppIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M12.011 0C5.384 0 0 5.383 0 12.01c0 2.116.547 4.178 1.588 6.005L.057 24l6.137-1.613a11.96 11.96 0 0 0 5.817 1.503c6.628 0 12.011-5.383 12.011-12.01C24.022 5.383 18.639 0 12.011 0zm0 21.993a9.946 9.946 0 0 1-5.076-1.387l-.364-.216-3.774.99.99-3.675-.237-.377a9.944 9.944 0 0 1-1.517-5.318c0-5.51 4.482-9.992 9.992-9.992 2.67 0 5.18 1.04 7.07 2.93a9.944 9.944 0 0 1 2.92 7.062c0 5.51-4.482 9.992-9.992 9.992zm5.488-7.534c-.3-.15-1.774-.875-2.048-.975-.275-.1-.475-.15-.675.15-.2.3-.775 1-.95 1.2-.175.2-.35.225-.65.075-.3-.15-1.265-.465-2.41-1.485-.89-.795-1.49-1.775-1.665-2.075-.175-.3-.02-.46.13-.61.135-.135.3-.35.45-.525.15-.175.2-.3.3-.5s.05-.375-.025-.525c-.075-.15-.675-1.625-.925-2.225-.244-.588-.49-.508-.675-.518-.175-.008-.375-.01-.575-.01-.2 0-.525.075-.8.375-.275.3-1.05 1.025-1.05 2.5s1.075 2.9 1.225 3.1c.15.2 2.11 3.225 5.115 4.525.715.31 1.27.5 1.705.64.715.23 1.365.2 1.88.12.575-.085 1.775-.725 2.025-1.425.25-.7.25-1.3 1.175-1.425-.075-.125-.275-.2-.575-.35z"/>
  </svg>
);

const TikTokIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.89 2.89 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1 .05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const VercelIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M24 22.525H0L12 1.475L24 22.525Z"/>
  </svg>
);

export default function App() {
  const [token, setToken] = useState<string>('');
  const [user, setUser] = useState<GitHubToken | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [repoName, setRepoName] = useState<string>('');
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    loadUserData();
    loadProjects();
  }, []);

  const loadUserData = async () => {
    const savedTokens = await db.tokens.toArray();
    if (savedTokens.length > 0) {
      setUser(savedTokens[0]);
      setToken(savedTokens[0].token);
    }
  };

  const loadProjects = async () => {
    const savedProjects = await db.projects.orderBy('createdAt').reverse().toArray();
    setProjects(savedProjects);
  };

  const validateToken = async (inputToken: string) => {
    try {
      setError(null);
      const octokit = new Octokit({ auth: inputToken });
      const { data } = await octokit.users.getAuthenticated();
      
      const userData: GitHubToken = {
        token: inputToken,
        username: data.login,
        avatarUrl: data.avatar_url
      };

      await db.tokens.clear();
      await db.tokens.add(userData);
      setUser(userData);
      setSuccess('Token GitHub berhasil divalidasi!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError('Token tidak valid atau terjadi kesalahan jaringan.');
      console.error(err);
    }
  };

  const handleLogout = async () => {
    await db.tokens.clear();
    setUser(null);
    setToken('');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.name.endsWith('.zip')) {
        setZipFile(file);
        setError(null);
      } else {
        setError('Hanya file .zip yang diperbolehkan.');
      }
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deployRepo = async () => {
    if (!user || !zipFile || !repoName) {
      setError('Mohon lengkapi semua data (Nama Repo & File ZIP).');
      return;
    }

    setIsDeploying(true);
    setStatus('Mengekstrak file ZIP...');
    setProgress(10);
    setError(null);

    try {
      const octokit = new Octokit({ auth: user.token });
      
      setStatus('Membuat repository baru di GitHub...');
      const { data: repo } = await octokit.repos.createForAuthenticatedUser({
        name: repoName,
        auto_init: false,
      });
      setProgress(30);

      const zip = new JSZip();
      const content = await zip.loadAsync(zipFile);
      const files = Object.keys(content.files).filter(path => !content.files[path].dir);
      
      for (let i = 0; i < files.length; i++) {
        const filePath = files[i];
        const fileContent = await content.files[filePath].async('base64');
        
        setStatus(`Mengunggah: ${filePath}`);
        await octokit.repos.createOrUpdateFileContents({
          owner: user.username,
          repo: repoName,
          path: filePath,
          message: `Initial commit: ${filePath}`,
          content: fileContent,
        });
        
        setProgress(30 + ((i + 1) / files.length) * 60);
      }

      const newProject: Project = {
        repoName: repoName,
        owner: user.username,
        url: repo.html_url,
        createdAt: Date.now()
      };
      await db.projects.add(newProject);
      
      setProgress(100);
      setStatus('Selesai!');
      setSuccess(`Repo ${repoName} berhasil di-deploy!`);
      setRepoName('');
      setZipFile(null);
      loadProjects();
      
      setTimeout(() => {
        setIsDeploying(false);
        setSuccess(null);
        setStatus('');
        setProgress(0);
      }, 3000);

    } catch (err: any) {
      setError(`Gagal: ${err.message || 'Terjadi kesalahan saat deploy.'}`);
      setIsDeploying(false);
    }
  };

  const deleteProject = async (project: Project) => {
    if (!user) return;
    
    const confirmDelete = window.confirm(`Apakah Anda yakin ingin menghapus repository "${project.repoName}"?`);
    if (!confirmDelete) return;

    try {
      const octokit = new Octokit({ auth: user.token });
      await octokit.repos.delete({
        owner: project.owner,
        repo: project.repoName
      });
      
      if (project.id) await db.projects.delete(project.id);
      loadProjects();
      setSuccess('Repository berhasil dihapus.');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(`Gagal menghapus: ${err.message}`);
      if (err.status === 404 && project.id) {
        await db.projects.delete(project.id);
        loadProjects();
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col selection:bg-brand/30">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px] bg-brand/10 blur-[160px] rounded-full -z-10 opacity-60"></div>
        
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/[0.03] border border-white/10 text-[10px] font-bold uppercase tracking-[0.2em] text-brand-light mb-4 shadow-2xl shadow-brand/10"
          >
            <Zap size={14} className="text-brand" />
            <span>Vercel Ready • ZIP to GitHub</span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-6xl md:text-8xl font-extrabold tracking-tight text-white"
          >
            Repo<span className="brand-gradient">Flow</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-lg md:text-2xl text-zinc-400 max-w-2xl mx-auto leading-relaxed font-medium"
          >
            Automate your workflow. Extract ZIP files and push them to GitHub repositories in one click.
          </motion.p>
        </div>
      </section>

      <main className="flex-1 max-w-4xl w-full mx-auto px-6 space-y-16 pb-32">
        {/* Status Messages */}
        <AnimatePresence>
          {(error || success) && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`p-6 rounded-[2rem] flex items-center gap-4 border backdrop-blur-xl ${error ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-green-500/10 border-green-500/20 text-green-400'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${error ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                {error ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}
              </div>
              <p className="text-sm font-semibold">{error || success}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature 1: GitHub Token Setup */}
        <section className="glass-card glow-border p-10">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center shadow-inner shadow-brand/20">
                <Key className="text-brand" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-2xl text-white">GitHub Access</h3>
                <p className="text-xs text-zinc-500 font-medium">Securely connect your account</p>
              </div>
            </div>
            {user && (
              <button onClick={handleLogout} className="px-4 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all">
                Disconnect
              </button>
            )}
          </div>

          {!user ? (
            <div className="space-y-8">
              <div className="flex flex-col md:flex-row gap-4">
                <input 
                  type="password" 
                  placeholder="Paste your Personal Access Token here..."
                  className="input-modern"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                />
                <button 
                  onClick={() => validateToken(token)}
                  className="btn-modern md:w-40 h-[60px]"
                >
                  Connect
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] space-y-4">
                  <div className="flex items-center gap-3 text-zinc-200 font-bold text-sm">
                    <ShieldCheck size={18} className="text-brand" />
                    <span>Quick Guide</span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">
                    Click the button to create a token. Scroll down, click 'Generate', and paste the code here.
                  </p>
                </div>
                <a 
                  href="https://github.com/settings/tokens/new?scopes=repo,delete_repo&description=RepoFlow_App" 
                  target="_blank"
                  className="flex items-center justify-between p-6 bg-white/[0.02] rounded-3xl border border-white/[0.05] hover:bg-white/[0.05] transition-all group"
                >
                  <div className="space-y-1">
                    <span className="text-sm font-bold text-zinc-200 block">Create Token</span>
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">GitHub Settings</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:bg-brand/20 transition-all">
                    <ChevronRight size={20} className="text-zinc-500 group-hover:text-brand group-hover:translate-x-1 transition-all" />
                  </div>
                </a>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-6 p-6 bg-brand/[0.03] rounded-3xl border border-brand/10">
              <div className="relative">
                <img src={user.avatarUrl} alt={user.username} className="w-16 h-16 rounded-2xl border-2 border-brand/20 shadow-2xl shadow-brand/20" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-4 border-bg-dark"></div>
              </div>
              <div>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mb-1">Authenticated Account</p>
                <p className="text-2xl font-black text-white tracking-tight">@{user.username}</p>
              </div>
            </div>
          )}
        </section>

        {/* Feature 2: Deployer */}
        <section className="glass-card glow-border p-10 space-y-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-brand/10 flex items-center justify-center shadow-inner shadow-brand/20">
              <Layers className="text-brand" size={24} />
            </div>
            <div>
              <h3 className="font-bold text-2xl text-white">Deploy Engine</h3>
              <p className="text-xs text-zinc-500 font-medium">Configure and push your code</p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] ml-1">Repository Name</label>
              <input 
                type="text" 
                placeholder="my-awesome-project"
                className="input-modern"
                value={repoName}
                onChange={(e) => setRepoName(e.target.value)}
                disabled={isDeploying}
              />
            </div>

            <div 
              onClick={() => !isDeploying && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault(); e.stopPropagation();
                if (isDeploying) return;
                const file = e.dataTransfer.files[0];
                if (file?.name.endsWith('.zip')) { setZipFile(file); setError(null); }
                else { setError('Hanya file .zip yang diperbolehkan.'); }
              }}
              className={`group relative border-2 border-dashed rounded-[3rem] p-20 flex flex-col items-center justify-center gap-8 transition-all duration-700 overflow-hidden ${zipFile ? 'border-brand bg-brand/[0.05]' : 'border-white/[0.05] hover:border-brand/30 bg-white/[0.01]'}`}
            >
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept=".zip" />
              
              {zipFile ? (
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 bg-brand/20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-2xl shadow-brand/20">
                    <FileArchive size={40} className="text-brand" />
                  </div>
                  <div>
                    <p className="font-black text-xl text-white tracking-tight">{zipFile.name}</p>
                    <p className="text-sm text-zinc-500 font-bold">{(zipFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setZipFile(null); }} className="px-6 py-2 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold hover:bg-red-500/20 transition-all">Change File</button>
                </div>
              ) : (
                <div className="text-center space-y-6">
                  <div className="w-20 h-20 bg-white/[0.03] rounded-3xl flex items-center justify-center mx-auto group-hover:scale-110 group-hover:bg-brand/10 transition-all duration-500">
                    <Upload size={40} className="text-zinc-600 group-hover:text-brand" />
                  </div>
                  <div>
                    <p className="font-bold text-xl text-zinc-300 tracking-tight">Drop your ZIP file here</p>
                    <p className="text-sm text-zinc-500 mt-2 font-medium">or click to browse your local files</p>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={deployRepo}
              disabled={isDeploying || !user || !zipFile || !repoName}
              className="w-full btn-modern py-6 text-xl shadow-2xl shadow-brand/20 group"
            >
              {isDeploying ? (
                <>
                  <Loader2 className="animate-spin" /> {status}
                </>
              ) : (
                <>
                  <Plus size={24} className="group-hover:rotate-90 transition-transform duration-500" /> Start Deployment
                </>
              )}
            </button>
            
            {isDeploying && (
              <div className="space-y-4 pt-4">
                <div className="flex justify-between text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                  <span>Deployment Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-3 bg-white/[0.03] rounded-full overflow-hidden p-1 border border-white/[0.05]">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-brand to-brand-light rounded-full shadow-lg shadow-brand/50"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Feature 3: Dashboard */}
        <section className="space-y-8">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <Code2 className="text-brand" size={24} />
              <h3 className="font-bold text-2xl text-white">Recent Work</h3>
            </div>
            <span className="px-4 py-1.5 bg-white/[0.03] border border-white/[0.05] rounded-full text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">{projects.length} Repositories</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {projects.length > 0 ? (
              projects.map((project) => (
                <motion.div 
                  layout
                  key={project.id}
                  className="glass-card p-6 flex items-center justify-between group hover:bg-white/[0.02] transition-all duration-500 border-white/[0.05] hover:border-brand/20"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-white/[0.03] rounded-2xl flex items-center justify-center group-hover:bg-brand/10 transition-all duration-500">
                      <Github className="text-zinc-500 group-hover:text-brand" size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-zinc-100 group-hover:text-white transition-colors text-lg tracking-tight">{project.repoName}</h4>
                      <p className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mt-1">{new Date(project.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
                    <button 
                      onClick={() => project.id && copyToClipboard(project.url, project.id)} 
                      className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-brand/20 transition-all"
                      title="Copy URL"
                    >
                      {copiedId === project.id ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                    </button>
                    <a href={project.url} target="_blank" className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-brand/20 transition-all" title="Open in GitHub">
                      <ExternalLink size={20} />
                    </a>
                    <button onClick={() => deleteProject(project)} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-zinc-400 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete Repository">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-24 text-center space-y-6 bg-white/[0.01] rounded-[2.5rem] border-2 border-dashed border-white/[0.05]">
                <div className="w-20 h-20 bg-white/[0.02] rounded-3xl flex items-center justify-center mx-auto">
                  <Globe size={40} className="text-zinc-800" />
                </div>
                <div>
                  <p className="text-zinc-500 font-bold text-xl tracking-tight">No deployments found</p>
                  <p className="text-sm text-zinc-700 font-medium mt-1">Your automated repositories will appear here.</p>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Footer & Branding */}
      <footer className="bg-zinc-950 border-t border-white/[0.05] pt-32 pb-16 px-6 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent"></div>
        
        <div className="max-w-4xl mx-auto space-y-20">
          {/* WhatsApp Card */}
          <motion.div 
            whileHover={{ y: -12, scale: 1.02 }}
            className="glass-card whatsapp-glow p-10 flex flex-col md:flex-row items-center justify-between gap-10 border-whatsapp/30 bg-whatsapp/[0.05] shadow-whatsapp/10"
          >
            <div className="flex items-center gap-8">
              <div className="w-24 h-24 bg-whatsapp/20 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-whatsapp/30">
                <WhatsAppIcon size={48} className="text-whatsapp" />
              </div>
              <div className="text-center md:text-left">
                <h2 className="font-black text-4xl text-white tracking-tight">Join Komunitas Code & AI</h2>
                <p className="text-zinc-400 mt-3 font-medium text-xl">Update tools & script terbaru setiap hari secara gratis.</p>
              </div>
            </div>
            <a 
              href="https://whatsapp.com/channel/0029VbBjyjlJ93wa6hwSWa0p" 
              target="_blank"
              className="w-full md:w-auto px-12 py-6 bg-whatsapp hover:bg-whatsapp/90 text-black font-black rounded-2xl flex items-center justify-center gap-3 transition-all shadow-2xl shadow-whatsapp/40 text-xl active:scale-95"
            >
              Join Channel <ExternalLink size={24} />
            </a>
          </motion.div>

          <div className="flex flex-col md:flex-row items-center justify-between gap-12 pt-12 border-t border-white/[0.05]">
            {/* Developer Profile */}
            <div className="flex items-center gap-6">
              <div className="relative">
                <img 
                  src="https://res.cloudinary.com/dwiozm4vz/image/upload/v1772959730/ootglrvfmykn6xsto7rq.png" 
                  alt="R_hmt ofc" 
                  className="w-20 h-20 rounded-3xl border border-white/10 shadow-2xl"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-brand rounded-full flex items-center justify-center border-4 border-zinc-950">
                  <Zap size={14} className="text-white" />
                </div>
              </div>
              <div className="text-left">
                <h4 className="font-black text-2xl text-white tracking-tight">R_hmt ofc</h4>
                <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest">Lead Developer & AI Architect</p>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex items-center gap-5">
              <a href="https://www.instagram.com/rahmt_nhw?igsh=MWQwcnB3bTA2ZnVidg==" target="_blank" className="w-14 h-14 glass-card flex items-center justify-center hover:bg-white/10 hover:border-pink-500/30 transition-all group">
                <Instagram size={24} className="text-zinc-500 group-hover:text-pink-500 transition-colors" />
              </a>
              <a href="https://www.tiktok.com/@r_hmtofc?_r=1&_t=ZS-94KRfWQjeUu" target="_blank" className="w-14 h-14 glass-card flex items-center justify-center hover:bg-white/10 hover:border-cyan-400/30 transition-all group">
                <TikTokIcon size={24} className="text-zinc-500 group-hover:text-white transition-colors" />
              </a>
              <a href="https://t.me/rAi_engine" target="_blank" className="w-14 h-14 glass-card flex items-center justify-center hover:bg-white/10 hover:border-blue-400/30 transition-all group">
                <Send size={24} className="text-zinc-500 group-hover:text-blue-400 transition-colors" />
              </a>
            </div>
          </div>

          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-4 text-[10px] font-black text-zinc-800 uppercase tracking-[0.5em]">
              <div className="h-px w-12 bg-zinc-900"></div>
              RepoFlow Deployment System
              <div className="h-px w-12 bg-zinc-900"></div>
            </div>
            
            <div className="flex items-center justify-center gap-3 px-6 py-3 rounded-2xl bg-white/[0.02] border border-white/[0.05] w-fit mx-auto group hover:border-white/10 transition-all">
              <VercelIcon size={16} className="text-white" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Optimized for Vercel Deployment</span>
            </div>

            <p className="text-xs text-zinc-700 font-bold">© 2026 RepoFlow. Engineered for performance.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
 
