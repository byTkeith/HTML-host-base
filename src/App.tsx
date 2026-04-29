import React, { useEffect, useState, useRef } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc,
  serverTimestamp
} from 'firebase/firestore';
import { FileCode, Upload, Trash2, ExternalLink, LogIn, LogOut, Copy, CheckCircle2 } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { handleFirestoreError, OperationType } from './lib/firestoreErrorHandler';

interface HTMLFile {
  id: string;
  content: string;
  createdAt: number;
  ownerId: string;
}

function generateId() {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState<HTMLFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setFiles([]);
      return;
    }

    const q = query(
      collection(db, 'htmlFiles'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const htmlFiles: HTMLFile[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        htmlFiles.push({
          id: docSnap.id,
          content: data.content,
          createdAt: data.createdAt,
          ownerId: data.ownerId,
        } as HTMLFile);
      });
      // Sort by newest first
      htmlFiles.sort((a, b) => b.createdAt - a.createdAt);
      setFiles(htmlFiles);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'htmlFiles');
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in', error);
    }
  };
  
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/html') {
      alert('Please upload an HTML file.');
      return;
    }
    
    // Check file size (Firestore limit is 1MB string size, let's limit file to 500kb to be safe)
    if (file.size > 500 * 1024) {
      alert('File size exceeds the 500KB limit for secure hosting.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        setIsUploading(true);
        const content = event.target?.result as string;
        
        if (!user) throw new Error("Must be logged in");
        
        const fileId = generateId();
        const fileRef = doc(db, 'htmlFiles', fileId);
        
        await setDoc(fileRef, {
          content,
          createdAt: Date.now(),
          ownerId: user.uid
        });
        
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'htmlFiles');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const deleteFile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this file?')) return;
    try {
      await deleteDoc(doc(db, 'htmlFiles', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `htmlFiles/${id}`);
    }
  };

  const copyUrl = (id: string) => {
    const url = `${window.location.origin}/view/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-[#fafafa] min-h-screen font-sans text-slate-900 flex flex-col">
      <nav className="h-16 px-10 flex items-center justify-between bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rounded-sm"></div>
          </div>
          <span className="font-bold text-lg tracking-tight">HTMLHost</span>
        </div>
        
        <div className="flex items-center gap-6">
          {user ? (
            <>
              <button 
                onClick={handleLogout}
                className="text-sm font-medium text-slate-500 hover:text-black flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
              {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-200 border border-slate-300"></div>
              )}
            </>
          ) : (
            <button 
              onClick={handleLogin}
              className="text-sm font-medium text-slate-500 hover:text-black flex items-center gap-2 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 flex flex-col items-center px-10 py-12 w-full">
        {!user ? (
          <div className="w-full max-w-2xl text-center py-20 mt-10">
            <h1 className="text-3xl font-extrabold tracking-tight mb-4">Instant HTML Hosting</h1>
            <p className="text-slate-500 mb-8 max-w-md mx-auto">
              Drop your file and share the link in seconds. No configuration needed.
            </p>
            <button 
              onClick={handleLogin}
              className="inline-flex px-6 py-3 bg-black text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Sign in to start
            </button>
          </div>
        ) : (
          <div className="w-full max-w-4xl flex flex-col items-center">
            <div className="w-full max-w-2xl mb-16">
              <div className="mb-8">
                <h1 className="text-3xl font-extrabold tracking-tight mb-2">Instant HTML Hosting</h1>
                <p className="text-slate-500">Drop your file and share the link in seconds. No configuration needed.</p>
              </div>
              
              <input 
                type="file" 
                accept=".html,.htm,text/html" 
                onChange={handleFileUpload}
                className="hidden"
                id="html-file-upload"
                ref={fileInputRef}
                disabled={isUploading}
              />
              <label 
                htmlFor="html-file-upload"
                className={`w-full bg-white border-2 border-dashed border-slate-200 rounded-2xl p-12 flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer group ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-black'}`}
              >
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-black transition-colors">
                  {isUploading ? (
                    <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin group-hover:border-white group-hover:border-t-slate-400"></div>
                  ) : (
                    <Upload className="w-6 h-6 text-slate-400 group-hover:text-white" />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-semibold">{isUploading ? 'Uploading...' : 'Click to upload or drag and drop'}</p>
                  <p className="text-xs text-slate-400 mt-1">HTML files only (max 500KB)</p>
                </div>
              </label>
            </div>

            <div className="w-full">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Recent Deployments</h2>
                <span className="text-xs font-medium text-slate-400">
                  {files.length} {files.length === 1 ? 'file' : 'files'}
                </span>
              </div>
              
              {files.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-12 text-center">
                  <p className="text-slate-500">You haven't uploaded any HTML files yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {files.map((file, index) => (
                    <div key={file.id} className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 ${index === 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'} rounded flex items-center justify-center font-mono text-xs font-bold`}>
                          HTML
                        </div>
                        <div>
                          <a href={`/view/${file.id}`} target="_blank" rel="noopener noreferrer" className="font-medium text-sm hover:underline" title={file.id}>
                            {file.id}.html
                          </a>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Deployed {new Date(file.createdAt).toLocaleDateString()} {new Date(file.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <button 
                          onClick={() => deleteFile(file.id)}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                          title="Delete file"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <div className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold uppercase text-slate-500">Active</div>
                        <button 
                          onClick={() => copyUrl(file.id)}
                          className={`px-4 py-2 ${index === 0 ? 'bg-black text-white hover:bg-slate-800' : 'border border-slate-200 text-black hover:bg-slate-50'} text-xs font-semibold rounded-lg transition-colors min-w-[90px] flex justify-center`}
                        >
                          {copiedId === file.id ? 'Copied' : 'Copy Link'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="w-full max-w-4xl mx-auto p-10 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-4">
        <div className="flex gap-6">
          <span>© {new Date().getFullYear()} HTMLHost</span>
          <a href="#" className="hover:text-black">Terms</a>
          <a href="#" className="hover:text-black">Privacy</a>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500"></div>
          <span>All systems operational</span>
        </div>
      </footer>
    </div>
  );
}
