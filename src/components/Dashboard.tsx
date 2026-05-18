import { useState, useEffect, cloneElement, FormEvent } from "react";
import { 
  Users, 
  Briefcase, 
  MessageSquare, 
  Plus, 
  LogOut, 
  ChevronRight,
  Search,
  LayoutDashboard,
  Clock,
  CheckCircle2,
  AlertCircle,
  Mail,
  Lock,
  Loader2,
  Trash2,
  PieChart as PieChartIcon,
  TrendingUp,
  Award,
  ShieldCheck,
  Calendar,
  DollarSign,
  UserPlus,
  Phone,
  Bell,
  Cpu,
  Zap,
  UserCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { auth, db, handleFirestoreError, OperationType } from "../lib/firebase";
import { 
  signOut, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword,
  updateProfile,
  updatePassword
} from "firebase/auth";
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  getDoc,
  getDocs,
  where
} from "firebase/firestore";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  LineChart,
  Line
} from "recharts";

// --- Constants ---
const ADMIN_EMAILS = ["ahmedeljeady@gmail.com", "ahmedjp070@gmail.com"];

// --- Types ---
interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'engineer';
  status: 'active' | 'suspended';
  createdAt?: any;
}

interface Invoice {
  id: string;
  projectId: string;
  amount: number;
  status: 'pending' | 'paid' | 'overdue';
  dueDate: any;
  createdAt: any;
}

interface Notification {
  id: string;
  userId?: string; // Optional: specific user
  role?: 'admin' | 'engineer'; // Optional: target role
  title: string;
  message: string;
  read: boolean;
  type: 'inquiry' | 'invoice' | 'project' | 'task';
  createdAt: any;
}

interface Inquiry {
  id: string;
  name: string;
  email: string;
  phone?: string;
  description: string;
  createdAt: any;
}

interface Client {
  id: string;
  name: string;
  email: string;
  company?: string;
  phone?: string;
  status: 'lead' | 'active' | 'past';
  createdAt: any;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'planning': 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    'in-progress': 'bg-luxury-accent/10 text-luxury-accent border-luxury-accent/20',
    'completed': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    'on-hold': 'bg-zinc-800 text-zinc-500 border-zinc-700'
  };
  return (
    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase border ${styles[status] || styles['planning']}`}>
      {status}
    </span>
  );
}

interface Project {
  id: string;
  clientId: string;
  title: string;
  description?: string;
  notes?: string;
  budget?: number;
  status: 'planning' | 'in-progress' | 'completed' | 'on-hold' | 'review';
  deadline?: any;
  createdAt: any;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  status: 'available' | 'busy' | 'away';
  lastActive?: any;
  createdAt: any;
}

interface Task {
  id: string;
  projectId: string;
  title: string;
  isCompleted: boolean;
  priority: 'low' | 'medium' | 'high';
  assignedTo?: string;
  assignedToEmail?: string;
  dueDate?: any;
}

interface Activity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  targetId?: string;
  targetType?: string;
  metadata?: any;
  createdAt: any;
}

const safeISODate = (date: any) => {
  if (!date) return "";
  try {
    const d = date.toDate ? date.toDate() : new Date(date);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split('T')[0];
  } catch (e) {
    return "";
  }
};

export default function Dashboard() {
  const [user, setUser] = useState(auth.currentUser);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'projects' | 'inquiries' | 'team' | 'reports' | 'financials' | 'my-tasks' | 'profile'>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const createNotification = async (notif: Omit<Notification, 'id' | 'createdAt' | 'read'>) => {
    try {
      await addDoc(collection(db, "notifications"), {
        ...notif,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  };

  const createActivity = async (action: string, targetId?: string, targetType?: string, metadata?: any) => {
    if (!user || !userProfile) return;
    try {
      await addDoc(collection(db, "activity"), {
        userId: user.uid,
        userName: userProfile.name,
        action,
        targetId,
        targetType,
        metadata,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error logging activity:", error);
    }
  };

  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Login Form State
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Auth setup and Profile Sync
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        const userDocRef = doc(db, "users", u.uid);
        onSnapshot(userDocRef, async (snap) => {
          if (snap.exists()) {
            setUserProfile({ id: snap.id, ...snap.data() } as UserProfile);
            setIsLoading(false);
          } else {
            const role = ADMIN_EMAILS.includes(u.email!) ? 'admin' : 'engineer';
            try {
              // Use setDoc with merge: true to safely initialize or update the profile
              await setDoc(userDocRef, {
                email: u.email,
                name: u.displayName || "New Member",
                role,
                status: 'active',
                createdAt: serverTimestamp()
              }, { merge: true });
              // The next snapshot will trigger and set isLoading to false
            } catch (err) {
              console.error("Profile initialization failed", err);
              // Fallback to avoid getting stuck in loading
              setUserProfile({ id: u.uid, email: u.email || "", name: u.displayName || "User", role: 'engineer', status: 'active', createdAt: new Date() });
              setIsLoading(false);
            }
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${u.uid}`);
          setIsLoading(false);
        });
      } else {
        setUser(null);
        setUserProfile(null);
        setIsLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // Data fetching based on Role
  useEffect(() => {
    if (!user || !userProfile) return;

    let qInquiries = query(collection(db, "inquiries"), orderBy("createdAt", "desc"));
    let qActivities = query(collection(db, "activity"), orderBy("createdAt", "desc"));
    let qClients = query(collection(db, "clients"), orderBy("createdAt", "desc"));
    let qProjects = query(collection(db, "projects"), orderBy("createdAt", "desc"));
    let qTeam = query(collection(db, "team"), orderBy("createdAt", "desc"));
    let qInvoices = query(collection(db, "invoices"), orderBy("createdAt", "desc"));
    let qNotifications = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
    let qAllTasks = query(collection(db, "tasks"));

    // If Admin, we ensure they have the right view. If Engineer, we default to workspace.
    if (userProfile?.role === 'engineer' && activeTab === 'overview') {
      setActiveTab('my-tasks');
    }

    // Presence Heartbeat & User Escalation
    const runHeartbeat = async () => {
      if (user) {
        // Update presence in team collection if possible
        const q = query(collection(db, "team"), where("email", "==", user.email));
        getDocs(q).then(snap => {
          if (!snap.empty) {
            updateDoc(doc(db, "team", snap.docs[0].id), { lastActive: serverTimestamp() });
          }
        });
      }
      
      if (user && user.email && ADMIN_EMAILS.includes(user.email) && userProfile?.role !== 'admin') {
        console.log("System Alert: Architect detected. Escalating privileges...");
        await updateDoc(doc(db, "users", user.uid), { role: 'admin' });
      }
    };
    runHeartbeat();

    // Data Listeners
    const unsubInquiries = onSnapshot(qInquiries, (snap) => {
      setInquiries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Inquiry)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "inquiries"));

    const unsubActivities = onSnapshot(qActivities, (snap) => {
      setActivities(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "activities"));

    const unsubClients = onSnapshot(qClients, (snap) => {
      setClients(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "clients"));

    const unsubProjects = onSnapshot(qProjects, (snap) => {
      setProjects(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "projects"));

    const unsubTeam = onSnapshot(qTeam, (snap) => {
      setTeam(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeamMember)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "team"));

    const unsubInvoices = onSnapshot(qInvoices, (snap) => {
      setInvoices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Invoice)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "invoices"));

    const unsubAllTasks = onSnapshot(qAllTasks, (snap) => {
      setAllTasks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "tasks"));

    const unsubNotifications = onSnapshot(qNotifications, (snap) => {
      setNotifications(snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Notification))
        .filter(n => {
          if (n.userId && n.userId === user.uid) return true;
          if (n.role && userProfile?.role && n.role === userProfile.role) return true;
          return false;
        })
      );
    }, (err) => handleFirestoreError(err, OperationType.LIST, "notifications"));

    // Overdue Invoices Check
    const checkOverdueInvoices = async () => {
      if (userProfile?.role !== 'admin') return;
      
      const now = new Date();
      const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
      
      for (const inv of pendingInvoices) {
        const dueDate = inv.dueDate?.toDate ? inv.dueDate.toDate() : new Date(inv.dueDate);
        if (dueDate < now) {
          // Update status to overdue
          await updateDoc(doc(db, "invoices", inv.id), { status: 'overdue' });
          // Create notification
          await createNotification({
            role: 'admin',
            title: "Overdue Invoice Alert",
            message: `Invoice for project ${inv.projectId} is overdue. Amount: $${inv.amount}`,
            type: 'invoice'
          });
        }
      }
    };

    if (invoices.length > 0) {
      checkOverdueInvoices();
    }

    return () => {
      unsubInquiries();
      unsubActivities();
      unsubClients();
      unsubProjects();
      unsubTeam();
      unsubInvoices();
      unsubAllTasks();
      unsubNotifications();
    };
  }, [user, userProfile]);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setLoginError("");
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed", error);
      setLoginError(error.message);
    }
  };

  const handleManualLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPass) return;
    
    setIsLoggingIn(true);
    setLoginError("");
    
    try {
      const result = await signInWithEmailAndPassword(auth, loginEmail, loginPass);
      // We don't necessarily block users from login if they are not admin here, 
      // but if the app was intended to be admin-only, we should keep it.
      // However, user said "multi-user for admins and engineers".
      // So let's allow login and the app will handle role-based UI.
    } catch (error: any) {
      console.error("Manual login failed", error);
      setLoginError("Invalid credentials or authentication error.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => signOut(auth);

  if (isLoading) return <div className="h-screen w-full flex items-center justify-center bg-zinc-950 text-white">Loading...</div>;

  if (!user) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-950 px-6">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full"
        >
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl text-center space-y-8 shadow-2xl">
            <div className="w-16 h-16 bg-luxury-accent/20 rounded-full flex items-center justify-center mx-auto">
              <LayoutDashboard className="w-8 h-8 text-luxury-accent" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-3xl font-serif text-white">Admin Portal</h1>
              <p className="text-zinc-400 text-xs uppercase tracking-widest">Authentication Required</p>
            </div>

            <form onSubmit={handleManualLogin} className="space-y-4 text-left">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-zinc-500 flex items-center gap-2">
                  <Mail size={12} /> Email Address
                </label>
                <input 
                  type="email" 
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:border-luxury-accent outline-none transition-colors"
                  placeholder="ahmedeljeady@gmail.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-zinc-500 flex items-center gap-2">
                  <Lock size={12} /> Password
                </label>
                <input 
                  type="password" 
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:border-luxury-accent outline-none transition-colors"
                  placeholder="••••••••"
                />
              </div>
              
              {loginError && (
                <p className="text-red-500 text-[10px] uppercase font-bold text-center pt-2">{loginError}</p>
              )}

              <button 
                disabled={isLoggingIn}
                className="w-full py-4 bg-white text-black font-bold rounded-lg hover:bg-luxury-accent transition-all flex items-center justify-center gap-2"
              >
                {isLoggingIn ? <Loader2 className="animate-spin" size={18} /> : "Authenticate"}
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-zinc-800"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold text-zinc-600"><span className="bg-zinc-900 px-2">Or continue with</span></div>
            </div>

            <button 
              onClick={handleGoogleLogin}
              className="w-full py-3 border border-zinc-800 text-white text-xs font-bold rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center gap-3"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google Account
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col md:flex-row relative">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-luxury-accent rounded flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-luxury-black" />
          </div>
          <span className="font-serif text-lg">Engine UI</span>
        </div>
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 text-zinc-400 hover:text-white transition-colors"
        >
          {isSidebarOpen ? <Plus className="rotate-45" size={24} /> : <div className="space-y-1.5"><div className="w-6 h-0.5 bg-current"></div><div className="w-6 h-0.5 bg-current"></div><div className="w-6 h-0.5 bg-current"></div></div>}
        </button>
      </div>

      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-zinc-950 border-r border-zinc-800 flex flex-col p-6 space-y-8 transition-transform duration-300 transform
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 md:static md:w-64
      `}>
        <div className="hidden md:flex items-center gap-3 px-2">
          <div className="w-8 h-8 bg-luxury-accent rounded flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-luxury-black" />
          </div>
          <span className="font-serif text-xl tracking-tight">Engine UI</span>
        </div>

        <nav className="flex-1 space-y-2">
          {userProfile?.role === 'admin' ? (
            <>
              <NavItem active={activeTab === 'overview'} icon={<LayoutDashboard />} label="Dashboard" onClick={() => { setActiveTab('overview'); setSelectedProject(null); setIsSidebarOpen(false); }} />
              <NavItem active={activeTab === 'clients'} icon={<Users />} label="Clients" onClick={() => { setActiveTab('clients'); setSelectedProject(null); setIsSidebarOpen(false); }} />
              <NavItem active={activeTab === 'projects' || !!selectedProject} icon={<Briefcase />} label="Project Hub" onClick={() => { setActiveTab('projects'); setSelectedProject(null); setIsSidebarOpen(false); }} />
              <NavItem active={activeTab === 'team'} icon={<ShieldCheck />} label="Team" onClick={() => { setActiveTab('team'); setSelectedProject(null); setIsSidebarOpen(false); }} />
              <NavItem active={activeTab === 'financials'} icon={<DollarSign />} label="Financials" onClick={() => { setActiveTab('financials'); setSelectedProject(null); setIsSidebarOpen(false); }} />
              <NavItem active={activeTab === 'reports'} icon={<PieChartIcon />} label="Analytics" onClick={() => { setActiveTab('reports'); setSelectedProject(null); setIsSidebarOpen(false); }} />
              <NavItem active={activeTab === 'inquiries'} icon={<MessageSquare />} label="Leads" badge={inquiries.length} onClick={() => { setActiveTab('inquiries'); setSelectedProject(null); setIsSidebarOpen(false); }} />
              <div className="pt-4 border-t border-zinc-900 mx-2"></div>
              <NavItem active={activeTab === 'profile'} icon={<UserCircle />} label="My Profile" onClick={() => { setActiveTab('profile'); setSelectedProject(null); setIsSidebarOpen(false); }} />
            </>
          ) : (
            <>
              <NavItem active={activeTab === 'my-tasks'} icon={<CheckCircle2 />} label="My Workspace" onClick={() => { setActiveTab('my-tasks'); setSelectedProject(null); setIsSidebarOpen(false); }} />
              <NavItem active={activeTab === 'projects' || !!selectedProject} icon={<Briefcase />} label="Project Access" onClick={() => { setActiveTab('projects'); setSelectedProject(null); setIsSidebarOpen(false); }} />
              <div className="pt-4 border-t border-zinc-900 mx-2"></div>
              <NavItem active={activeTab === 'profile'} icon={<UserCircle />} label="My Profile" onClick={() => { setActiveTab('profile'); setSelectedProject(null); setIsSidebarOpen(false); }} />
            </>
          )}
        </nav>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 text-zinc-500 hover:text-red-400 transition-colors mt-auto border-t border-zinc-900 pt-6"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-x-hidden overflow-y-auto p-6 md:p-12">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
          <div>
            <span className="text-luxury-accent text-[10px] uppercase tracking-[0.3em] font-bold">
              {userProfile?.role === 'admin' ? "Architect Admin" : "Field Engineer"}
            </span>
            <h2 className="text-3xl md:text-4xl font-serif mt-2 capitalize">{selectedProject ? 'Detailed Ecosystem' : activeTab.replace('-', ' ')}</h2>
          </div>
          <div className="flex items-center gap-4">
            <NotificationCenter 
              notifications={notifications} 
              userRole={userProfile?.role || 'engineer'} 
            />
            <div className="flex items-center gap-4 bg-zinc-900/50 p-3 rounded-2xl border border-zinc-800/50">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium">{user.displayName || "Admin"}</p>
                <p className="text-[10px] text-zinc-500 font-mono italic">{user.email}</p>
              </div>
              {user.photoURL && <img src={user.photoURL} alt="" className="w-10 h-10 rounded-full border border-zinc-800" />}
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={selectedProject ? `project-${selectedProject.id}` : activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {selectedProject ? (
              <ProjectDetailsView 
                project={selectedProject} 
                client={clients.find(c => c.id === selectedProject.clientId)} 
                team={team}
                onBack={() => setSelectedProject(null)}
                userRole={userProfile?.role || 'engineer'}
                createNotification={createNotification}
              />
            ) : (
              <>
                {activeTab === 'overview' && userProfile?.role === 'admin' && <Overview activities={activities} inquiries={inquiries} clients={clients} projects={projects} team={team} invoices={invoices} />}
                {activeTab === 'my-tasks' && <EngineerWorkspace projects={projects} team={team} user={user} createActivity={createActivity} />}
                {activeTab === 'inquiries' && <InquiriesList inquiries={inquiries} createActivity={createActivity} />}
                {activeTab === 'clients' && <ClientsModule clients={clients} createActivity={createActivity} />}
                {activeTab === 'projects' && <ProjectsModule projects={projects} clients={clients} onSelectProject={setSelectedProject} createActivity={createActivity} />}
                {activeTab === 'team' && <TeamModule team={team} createActivity={createActivity} />}
                {activeTab === 'financials' && <FinancialsModule projects={projects} invoices={invoices} createActivity={createActivity} />}
                {activeTab === 'reports' && <ReportsModule projects={projects} clients={clients} team={team} inquiries={inquiries} allTasks={allTasks} />}
                {activeTab === 'profile' && <ProfileView user={user} userProfile={userProfile} createActivity={createActivity} />}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function NotificationCenter({ notifications, userRole }: { notifications: Notification[], userRole: 'admin' | 'engineer' }) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      await updateDoc(doc(db, "notifications", n.id), { read: true });
    }
  };

  const markAsRead = async (id: string) => {
    await updateDoc(doc(db, "notifications", id), { read: true });
  };

  const deleteNotification = async (id: string) => {
    await deleteDoc(doc(db, "notifications", id));
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="p-3 bg-zinc-900/50 rounded-2xl border border-zinc-800/50 text-zinc-400 hover:text-luxury-accent transition-all relative"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center border-2 border-zinc-950">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40"
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-4 w-80 sm:w-96 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                <h3 className="font-serif text-lg">System Alerts</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllAsRead} className="text-[10px] text-luxury-accent font-bold uppercase tracking-widest hover:underline">
                    Clear All
                  </button>
                )}
              </div>
              
              <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 && (
                  <div className="px-8 py-12 text-center text-zinc-500 italic space-y-3">
                    <div className="p-3 bg-zinc-950 w-fit mx-auto rounded-full"><Bell className="opacity-20" size={32} /></div>
                    <p className="text-xs">Operational environment is quiet.</p>
                  </div>
                )}
                {notifications.map(n => (
                  <div 
                    key={n.id} 
                    className={`p-6 border-b border-zinc-800/50 flex gap-4 hover:bg-zinc-800/20 transition-all group ${!n.read ? 'bg-luxury-accent/5' : ''}`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${!n.read ? 'bg-luxury-accent shadow-[0_0_8px_#c5a358]' : 'bg-zinc-800'}`} />
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-start gap-2">
                        <p className={`text-sm font-medium ${!n.read ? 'text-white' : 'text-zinc-400'}`}>{n.title}</p>
                        <button onClick={() => deleteNotification(n.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500 transition-all">
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">{n.message}</p>
                      <p className="text-[9px] text-zinc-700 font-bold uppercase mt-2">
                        {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : new Date(n.createdAt).toLocaleString()}
                      </p>
                    </div>
                    {!n.read && (
                      <button 
                        onClick={() => markAsRead(n.id)}
                        className="self-center p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-luxury-accent hover:bg-luxury-accent hover:text-black transition-all"
                      >
                         <CheckCircle2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              <div className="p-4 bg-zinc-950/50 text-center border-t border-zinc-800">
                 <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest">End of Logic Stream</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function NavItem({ active, icon, label, onClick, badge }: { active: boolean, icon: any, label: string, onClick: () => void, badge?: number }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
        active ? 'bg-luxury-accent text-luxury-black' : 'text-zinc-500 hover:bg-zinc-900 hover:text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        {cloneElement(icon, { size: 18 })}
        <span className="text-sm font-medium">{label}</span>
      </div>
      {badge ? (
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${active ? 'bg-luxury-black text-white' : 'bg-zinc-800'}`}>
          {badge}
        </span>
      ) : null}
    </button>
  );
}

// --- Sub-Components ---

function Overview({ activities, inquiries, clients, projects, team, invoices }: { activities: Activity[], inquiries: Inquiry[], clients: Client[], projects: Project[], team: TeamMember[], invoices: Invoice[] }) {
  const totalRevenue = projects.reduce((acc, p) => acc + (p.budget || 0), 0);
  const pendingInvoices = invoices.filter(i => i.status !== 'paid').reduce((acc, i) => acc + i.amount, 0);

  const chartData = [
    { name: 'Leads', value: inquiries.length, color: '#60a5fa' },
    { name: 'Clients', value: clients.length, color: '#4ade80' },
    { name: 'Projects', value: projects.length, color: '#c5a358' },
    { name: 'Team', value: team.length, color: '#a855f7' },
  ];

  const recentProjects = [...projects].sort((a, b) => {
    const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
    const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
    return timeB - timeA;
  }).slice(0, 3);

  const getActivityIcon = (action: string) => {
    if (action.includes('Project')) return <Briefcase size={16} />;
    if (action.includes('Inquiry') || action.includes('Lead')) return <MessageSquare size={16} />;
    if (action.includes('Bootstrap') || action.includes('System')) return <Cpu size={16} />;
    if (action.includes('Financial') || action.includes('Invoice')) return <DollarSign size={16} />;
    return <Clock size={16} />;
  };

  return (
    <div className="space-y-10">
      {/* Executive Command Section */}
      <div className="flex justify-between items-end gap-6 bg-zinc-900 border border-zinc-800 p-8 rounded-3xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-luxury-accent/5 rounded-full -mr-48 -mt-48 blur-3xl"></div>
        <div className="relative z-10 space-y-2">
          <h2 className="text-4xl font-serif">Command Center</h2>
          <p className="text-zinc-500 text-xs uppercase font-bold tracking-[0.2em]">Operational Pulse & Strategic View</p>
        </div>
      </div>

      {/* Top Cards - Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Revenue" val={`$${totalRevenue.toLocaleString()}`} icon={<DollarSign />} color="text-luxury-accent" isCurrency />
        <StatCard label="Pending Funds" val={`$${pendingInvoices.toLocaleString()}`} icon={<Clock />} color="text-amber-400" isCurrency />
        <StatCard label="Active Fleet" val={projects.filter(p => p.status === 'in-progress').length} icon={<Briefcase />} color="text-blue-400" />
        <StatCard label="Inquiry Flow" val={inquiries.length} icon={<MessageSquare />} color="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Distribution Chart */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10">
              <h3 className="text-xl font-serif flex items-center gap-3">
                <TrendingUp className="text-luxury-accent" size={20} /> Ecosystem Performance
              </h3>
              <div className="flex gap-4">
                {chartData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></div>
                    <span className="text-[10px] uppercase font-bold text-zinc-500">{d.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#71717a', fontSize: 10, fontWeight: 700 }}
                    dy={10}
                  />
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl shadow-2xl">
                            <p className="text-[10px] uppercase font-bold text-zinc-500 mb-1">{payload[0].payload.name}</p>
                            <p className="text-2xl font-serif text-white">{payload[0].value}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={60}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.9} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Recent Projects List */}
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl">
            <h3 className="text-xl font-serif mb-8 flex items-center gap-3">
              <Briefcase className="text-luxury-accent" size={20} /> Active Deployments
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               {recentProjects.map(p => (
                 <div key={p.id} className="bg-zinc-950 p-6 rounded-2xl border border-zinc-800 hover:border-luxury-accent/20 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                       <StatusBadge status={p.status} />
                       <ChevronRight className="text-zinc-800 group-hover:text-luxury-accent transition-colors" size={14} />
                    </div>
                    <h4 className="font-serif text-lg leading-tight mb-2">{p.title}</h4>
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">${p.budget?.toLocaleString()}</p>
                 </div>
               ))}
               {recentProjects.length === 0 && <p className="col-span-3 text-center py-6 text-zinc-700 italic text-sm">No active deployments.</p>}
            </div>
          </div>
        </div>

        {/* Real-time Logic Stream */}
        <div className="space-y-8">
           <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl flex flex-col justify-between h-full min-h-[400px]">
            <div>
              <h3 className="text-xl font-serif mb-8 flex items-center gap-3">
                <Clock className="text-luxury-accent" size={20} /> Logic Stream
              </h3>
              <div className="space-y-5">
                {activities.slice(0, 8).map(act => (
                  <div key={act.id} className="flex gap-4 p-4 bg-zinc-950 rounded-2xl border border-zinc-800/50 hover:border-luxury-accent/30 transition-all cursor-pointer group">
                    <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-600 group-hover:text-luxury-accent transition-colors">
                      {getActivityIcon(act.action)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[13px] text-zinc-200 truncate">{act.action}</p>
                      <p className="text-[10px] text-zinc-500 font-medium mt-0.5 flex justify-between">
                        <span>{act.userName}</span>
                        <span className="font-mono opacity-50">
                          {act.createdAt?.toDate ? act.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                        </span>
                      </p>
                    </div>
                  </div>
                ))}
                {activities.length === 0 && (
                  <div className="text-center py-10">
                    <div className="p-4 bg-zinc-950 rounded-full w-fit mx-auto mb-4 border border-zinc-800">
                      <Clock size={24} className="text-zinc-800" />
                    </div>
                    <p className="text-zinc-600 text-xs italic">System quiet. No new activity.</p>
                  </div>
                )}
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-zinc-800">
              <div className="flex justify-between items-center text-[10px] uppercase font-bold tracking-widest text-zinc-600">
                 <span>Operational Status</span>
                 <span className="text-emerald-500 animate-pulse flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    Active
                 </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, val, icon, color, isCurrency }: { label: string, val: string | number, icon: any, color: string, isCurrency?: boolean }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 p-6 text-zinc-800 group-hover:text-luxury-accent transition-all transform group-hover:scale-110">
        {cloneElement(icon as any, { size: 32, strokeWidth: 1 })}
      </div>
      <div className="relative z-10 space-y-4">
        <div className={`w-10 h-10 rounded-xl bg-zinc-950 flex items-center justify-center ${color}`}>
          {cloneElement(icon as any, { size: 18 })}
        </div>
        <div>
          <p className="text-zinc-500 text-[10px] uppercase tracking-widest font-bold">{label}</p>
          <h3 className={`text-2xl font-serif mt-1 ${isCurrency ? 'text-white' : ''}`}>{val}</h3>
        </div>
      </div>
    </div>
  );
}

function InquiriesList({ inquiries, createActivity }: { inquiries: Inquiry[], createActivity: (action: string, targetId?: string, targetType?: string, metadata?: any) => Promise<void> }) {
  const [convertingId, setConvertingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      if (!confirm("Are you sure you want to dismiss this inquiry?")) return;
      await deleteDoc(doc(db, "inquiries", id));
      await createActivity("Dismissed an inquiry", id, 'inquiry');
    } catch (err: any) {
      console.error("Delete failed", err);
      alert("Failed to delete inquiry: " + err.message);
    }
  };

  const handleConvertToClient = async (inq: Inquiry) => {
    setConvertingId(inq.id);
    try {
      // 1. Create client
      const clientRef = await addDoc(collection(db, "clients"), {
        name: inq.name,
        email: inq.email,
        phone: inq.phone || null,
        status: 'active',
        createdAt: serverTimestamp()
      });

      // 2. Create initial project
      await addDoc(collection(db, "projects"), {
        clientId: clientRef.id,
        title: `Ecosystem Setup: ${inq.name}`,
        description: inq.description,
        status: 'planning',
        budget: 0,
        createdAt: serverTimestamp()
      });

      // 3. Log Activity
      await createActivity(`Converted Lead into Client: ${inq.name}`, clientRef.id, 'client');

      // 4. Delete inquiry
      await deleteDoc(doc(db, "inquiries", inq.id));
      
    } catch (err) {
      console.error("Conversion failed", err);
    } finally {
      setConvertingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      {inquiries.length === 0 && (
        <div className="bg-zinc-900 border border-zinc-800 p-20 rounded-2xl text-center">
          <MessageSquare className="mx-auto text-zinc-800 mb-4" size={48} />
          <p className="text-zinc-500 font-serif text-xl">Inbox is vacant.</p>
        </div>
      )}
      {inquiries.map((inq) => (
        <div key={inq.id} className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-2xl group hover:border-luxury-accent/50 transition-all">
          <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
            <div>
              <h3 className="text-xl md:text-2xl font-serif text-white">{inq.name}</h3>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <p className="text-zinc-500 text-sm flex items-center gap-1"><Mail size={12} /> {inq.email}</p>
                {inq.phone && (
                  <p className="text-zinc-500 text-sm flex items-center gap-1"><Phone size={12} /> {inq.phone}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col items-start md:items-end gap-3 w-full md:w-auto">
              <span className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">
                Received: {inq.createdAt?.toDate().toLocaleDateString()}
              </span>
              <div className="flex gap-2 w-full md:w-auto">
                <button 
                  onClick={() => handleDelete(inq.id)}
                  className="p-2 text-zinc-600 hover:text-red-500 transition-colors bg-zinc-950 rounded-lg border border-zinc-800"
                >
                  <Trash2 size={16} />
                </button>
                <button 
                  onClick={() => handleConvertToClient(inq)}
                  disabled={convertingId === inq.id}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 text-luxury-accent hover:bg-luxury-accent hover:text-black transition-all text-[10px] font-bold uppercase tracking-widest bg-zinc-950 px-4 py-2 rounded-lg border border-luxury-accent/20"
                >
                  {convertingId === inq.id ? <Loader2 className="animate-spin" size={14} /> : <Plus size={14} />} Convert
                </button>
              </div>
            </div>
          </div>
          <div className="bg-zinc-950 p-6 md:p-8 rounded-xl border border-zinc-800/50 relative">
             <div className="absolute top-4 left-4 text-zinc-900"><MessageSquare size={40} strokeWidth={0.5} /></div>
             <p className="text-zinc-400 text-sm leading-relaxed relative z-10 whitespace-pre-wrap pl-4 border-l border-luxury-accent/30">
              {inq.description}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ClientsModule({ clients, createActivity }: { clients: Client[], createActivity: (action: string, targetId?: string, targetType?: string, metadata?: any) => Promise<void> }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, "clients"), {
      name, email, phone, company, status: 'active', createdAt: serverTimestamp()
    });
    setName(""); setEmail(""); setPhone(""); setCompany(""); setShowAdd(false);
  };

  const updateStatus = async (id: string, status: string) => {
    await updateDoc(doc(db, "clients", id), { status });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Execute deletion protocol for this client?")) return;
    await deleteDoc(doc(db, "clients", id));
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-luxury-accent text-luxury-black px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-colors"
        >
          <Plus size={18} /> New Profile
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleAdd}
            className="bg-zinc-900 border border-zinc-800 p-6 md:p-10 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-8 items-end overflow-hidden"
          >
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Identify Name</label>
              <input required placeholder="Client Alias" value={name} onChange={e => setName(e.target.value)} type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-luxury-accent outline-none transition-all" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Mail Communications</label>
              <input required placeholder="client@protocol.com" value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-luxury-accent outline-none transition-all" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Entity / Company</label>
              <input placeholder="Optional Entity" value={company} onChange={e => setCompany(e.target.value)} type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-luxury-accent outline-none transition-all" />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Contact Phone</label>
              <input placeholder="+20 ..." value={phone} onChange={e => setPhone(e.target.value)} type="tel" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-luxury-accent outline-none transition-all" />
            </div>
            <div className="md:col-span-4 flex flex-col sm:flex-row justify-end gap-4 mt-4">
               <button type="button" onClick={() => setShowAdd(false)} className="text-zinc-500 text-xs font-bold uppercase py-3">Cancel</button>
               <button className="bg-white text-black px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-luxury-accent transition-colors w-full sm:w-auto">Initialize Profile</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-x-auto shadow-2xl">
        <table className="w-full text-left min-w-[900px]">
          <thead className="bg-zinc-950 text-zinc-500 text-[10px] uppercase font-bold tracking-[0.2em]">
            <tr>
              <th className="px-8 py-6">Identity</th>
              <th className="px-8 py-6">Communication</th>
              <th className="px-8 py-6">Entity</th>
              <th className="px-8 py-6">Protocol Status</th>
              <th className="px-8 py-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {clients.map(client => (
              <tr key={client.id} className="hover:bg-zinc-800/20 transition-colors group">
                <td className="px-8 py-6">
                  <div className="font-serif text-lg">{client.name}</div>
                  <div className="text-[10px] text-zinc-600 font-mono italic">UID: {client.id.slice(0, 8)}</div>
                </td>
                <td className="px-8 py-6">
                  <div className="text-xs text-zinc-300 font-medium flex items-center gap-2"><Mail size={12} /> {client.email}</div>
                  {client.phone && <div className="text-[10px] text-zinc-500 flex items-center gap-2 mt-1"><Phone size={10} /> {client.phone}</div>}
                </td>
                <td className="px-8 py-6 text-sm text-zinc-400 font-light">{client.company || '-'}</td>
                <td className="px-8 py-6 text-[10px] text-zinc-500 font-medium">{client.createdAt?.toDate().toLocaleDateString()}</td>
                <td className="px-8 py-6">
                  <select 
                    value={client.status} 
                    onChange={(e) => updateStatus(client.id, e.target.value)}
                    className={`bg-transparent text-[10px] font-bold uppercase transition-colors outline-none cursor-pointer ${
                      client.status === 'active' ? 'text-green-500' : 'text-zinc-500'
                    }`}
                  >
                    <option value="active" className="bg-zinc-900">Active</option>
                    <option value="lead" className="bg-zinc-900">Lead</option>
                    <option value="past" className="bg-zinc-900">Past</option>
                  </select>
                </td>
                <td className="px-8 py-6 text-right">
                   <button 
                    onClick={() => handleDelete(client.id)}
                    className="p-2 text-zinc-700 hover:text-red-500 transition-all transform group-hover:scale-110"
                   >
                     <Trash2 size={16} />
                   </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProjectsModule({ projects, clients, onSelectProject, createActivity }: { projects: Project[], clients: Client[], onSelectProject: (p: Project) => void, createActivity: (action: string, targetId?: string, targetType?: string, metadata?: any) => Promise<void> }) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [budget, setBudget] = useState("");

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    const docRef = await addDoc(collection(db, "projects"), {
      title, clientId, budget: Number(budget), status: 'planning', createdAt: serverTimestamp()
    });
    await createActivity(`Initiated new Project: ${title}`, docRef.id, 'project');
    setTitle(""); setClientId(""); setBudget(""); setShowAdd(false);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-luxury-accent text-luxury-black px-4 py-2 rounded-lg font-bold text-sm"
        >
          <Plus size={18} /> New Project
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleAdd}
            className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-6 items-end overflow-hidden"
          >
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-zinc-500">Project Engine Name</label>
              <input required value={title} onChange={e => setTitle(e.target.value)} type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:border-luxury-accent outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-zinc-500">Assign to Client</label>
              <select required value={clientId} onChange={e => setClientId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:border-luxury-accent outline-none">
                <option value="">Select Target...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-zinc-500">Financial Budget ($)</label>
              <input value={budget} onChange={e => setBudget(e.target.value)} type="number" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-sm focus:border-luxury-accent outline-none" />
            </div>
            <div className="md:col-span-3 flex flex-col sm:flex-row justify-end gap-4 mt-4">
              <button type="button" onClick={() => setShowAdd(false)} className="text-zinc-500 text-sm font-bold uppercase py-2">Cancel</button>
              <button className="bg-white text-black px-6 py-2 rounded-lg font-bold text-sm w-full sm:w-auto">Initialize Project</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
        {projects.map(project => {
          const client = clients.find(c => c.id === project.clientId);
          return (
            <div 
              key={project.id} 
              onClick={() => onSelectProject(project)}
              className="bg-zinc-900 border border-zinc-800 p-10 rounded-2xl space-y-6 hover:border-luxury-accent/30 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={project.status} />
                    <span className="text-[10px] text-zinc-600 font-bold uppercase">ID: {project.id.slice(0, 8)}</span>
                  </div>
                  <h3 className="text-3xl font-serif group-hover:text-luxury-accent transition-colors">{project.title}</h3>
                  <p className="text-sm font-medium text-zinc-500 mt-1">{client?.name || 'Archive Client'}</p>
                </div>
                <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800 group-hover:bg-luxury-accent group-hover:text-black transition-colors">
                  <Briefcase size={20} />
                </div>
              </div>
              
              <div className="flex justify-between items-end pt-8 border-t border-zinc-800/50">
                <div className="space-y-1">
                  <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">Allocation</p>
                  <p className="text-2xl font-serif">${project.budget?.toLocaleString() || '0'}</p>
                </div>
                <button className="flex items-center gap-2 text-luxury-accent text-xs font-bold uppercase tracking-widest group-hover:gap-4 transition-all">
                  Manage Engine <ChevronRight size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProjectDetailsView({ project, client, team, onBack, userRole, createNotification }: { project: Project, client?: Client, team: TeamMember[], onBack: () => void, userRole: 'admin' | 'engineer', createNotification: (n: any) => Promise<void> }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const isAdmin = userRole === 'admin';
  const [newTask, setNewTask] = useState("");
  const [taskPriority, setTaskPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskAssignee, setTaskAssignee] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [newBudget, setNewBudget] = useState(project.budget?.toString() || "");
  const [notes, setNotes] = useState(project.notes || "");

  useEffect(() => {
    setNotes(project.notes || "");
  }, [project.notes]);

  const updateNotes = async () => {
    setIsUpdating(true);
    await updateDoc(doc(db, "projects", project.id), { notes });
    setIsUpdating(false);
  };

  useEffect(() => {
    const qTasks = query(collection(db, "tasks"), orderBy("title", "asc"));
    const unsubscribe = onSnapshot(qTasks, (snap) => {
      setTasks(snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Task))
        .filter(t => t.projectId === project.id)
      );
    }, (err) => handleFirestoreError(err, OperationType.LIST, "tasks"));
    return unsubscribe;
  }, [project.id]);

  const addTask = async (e: FormEvent) => {
    e.preventDefault();
    if (!newTask) return;
    await addDoc(collection(db, "tasks"), {
      projectId: project.id,
      title: newTask,
      isCompleted: false,
      priority: taskPriority,
      assignedTo: taskAssignee || null,
      dueDate: null,
      createdAt: serverTimestamp()
    });

    if (taskAssignee) {
      const assignedToName = team.find(t => t.id === taskAssignee)?.name || "a team member";
      await createNotification({
        userId: taskAssignee,
        title: "New Deployment Task",
        message: `Architectural directive: You have been assigned "${newTask}" for project "${project.title}".`,
        type: 'task'
      });
    }

    setNewTask("");
    setTaskAssignee("");
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    await updateDoc(doc(db, "tasks", taskId), updates);
    if (updates.assignedTo) {
      const task = tasks.find(t => t.id === taskId);
      await createNotification({
        userId: updates.assignedTo,
        title: "Task Protocol Reassigned",
        message: `Direct instruction: Task "${task?.title || 'Unknown'}" reassigned to you in project "${project.title}".`,
        type: 'task'
      });
    }
  };

  const toggleTask = async (task: Task) => {
    await updateTask(task.id, { isCompleted: !task.isCompleted });
  };

  const deleteTask = async (taskId: string) => {
    await deleteDoc(doc(db, "tasks", taskId));
  };

  const updateStatus = async (status: string) => {
    setIsUpdating(true);
    await updateDoc(doc(db, "projects", project.id), { status });
    await createNotification({
      role: 'admin',
      title: "Project Status Updated",
      message: `Project "${project.title}" status changed to ${status}.`,
      type: 'project'
    });
    setIsUpdating(false);
  };

  const updateBudget = async () => {
    const budgetValue = Number(newBudget);
    if (isNaN(budgetValue)) return;
    setIsUpdating(true);
    await updateDoc(doc(db, "projects", project.id), { budget: budgetValue });
    setIsUpdating(false);
  };

  const handleDeleteProject = async () => {
    if (!confirm("Terminate this project ecosystem? This cannot be undone.")) return;
    await deleteDoc(doc(db, "projects", project.id));
    onBack();
  };

  return (
    <div className="space-y-10 pb-20">
      <div className="flex justify-between items-center">
        <button onClick={onBack} className="text-zinc-500 hover:text-white flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] transition-colors">
          <ChevronRight className="rotate-180" size={14} /> {isAdmin ? "Back to Fleet" : "Back to Workspace"}
        </button>
        {isAdmin && (
          <button 
            onClick={handleDeleteProject}
            className="text-red-500/50 hover:text-red-500 flex items-center gap-2 text-[10px] font-bold uppercase transition-colors"
          >
            <Trash2 size={14} /> Terminate Project
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-4">
           <div className="flex justify-between items-end">
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Execution Pulse</p>
              <span className="text-xs font-mono text-luxury-accent">
                {tasks.length > 0 ? Math.round((tasks.filter(t => t.isCompleted).length / tasks.length) * 100) : 0}%
              </span>
           </div>
           <div className="h-2 bg-black rounded-full overflow-hidden border border-zinc-900">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${tasks.length > 0 ? (tasks.filter(t => t.isCompleted).length / tasks.length) * 100 : 0}%` }}
                className="h-full bg-luxury-accent"
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
           </div>
           <p className="text-[10px] text-zinc-600 italic">
             {tasks.filter(t => t.isCompleted).length} of {tasks.length} strategic milestones reached.
           </p>
        </div>
        
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl flex flex-col justify-between">
           <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Strategic Valuation</p>
           <h4 className="text-3xl font-serif text-luxury-accent">${project.budget?.toLocaleString() || 0}</h4>
           <p className="text-[10px] text-zinc-600 mt-2">Resource Reservation Active</p>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl flex flex-col justify-between">
           <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Sector Status</p>
           <div className="flex items-center gap-3">
             <div className={`w-3 h-3 rounded-full animate-pulse ${
               project.status === 'completed' ? 'bg-emerald-500' :
               project.status === 'in-progress' ? 'bg-blue-500' :
               project.status === 'review' ? 'bg-amber-500' : 'bg-zinc-700'
             }`}></div>
             <h4 className="text-2xl font-serif capitalize">{project.status}</h4>
           </div>
           <p className="text-[10px] text-zinc-600 mt-2">Active Milestone: {tasks.find(t => !t.isCompleted)?.title || 'Finalizing'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <div className="bg-zinc-900 border border-zinc-800 p-6 md:p-12 rounded-3xl relative overflow-hidden shadow-2xl">
             <div className="absolute top-0 right-0 w-96 h-96 bg-luxury-accent/5 rounded-full -mr-48 -mt-48 blur-3xl shadow-inline"></div>
             
             <div className="relative z-10">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 mb-10">
                  <div>
                    <h1 className="text-4xl md:text-6xl font-serif mb-4 leading-tight">{project.title}</h1>
                    <div className="flex flex-wrap items-center gap-4">
                       <p className="text-zinc-500 text-sm">
                          Client: <span className="text-luxury-accent font-medium">{client?.name || 'Decommissioned Client'}</span>
                       </p>
                       <div className="hidden sm:block w-1 h-1 bg-zinc-800 rounded-full"></div>
                       <p className="text-zinc-600 text-[10px] font-bold tracking-widest uppercase">EID: {project.id?.slice(0, 12) || 'N/A'}</p>
                    </div>
                  </div>
                  <StatusBadge status={project.status} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10 mt-16 py-10 border-y border-zinc-800/30">
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Logic State</p>
                    <select 
                      disabled={isUpdating || !isAdmin}
                      value={project.status}
                      onChange={(e) => updateStatus(e.target.value)}
                      className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white focus:border-luxury-accent outline-none appearance-none cursor-pointer ${!isAdmin && 'opacity-50 cursor-not-allowed'}`}
                    >
                      <option value="planning">Phase: Planning</option>
                      <option value="in-progress">Phase: Engineering</option>
                      <option value="completed">Phase: Finalized</option>
                      <option value="on-hold">Phase: Suspended</option>
                    </select>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Resource Allocation</p>
                    <div className="flex gap-2">
                       <input 
                        type="number" 
                        disabled={!isAdmin}
                        value={newBudget}
                        onChange={(e) => setNewBudget(e.target.value)}
                        onBlur={updateBudget}
                        className={`bg-transparent text-2xl font-serif text-white w-full border-b border-zinc-800 focus:border-luxury-accent outline-none ${!isAdmin && 'opacity-50'}`}
                       />
                       <span className="text-zinc-700 font-serif text-2xl">$</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Protocol Sync</p>
                    <p className="text-sm font-medium text-zinc-400 break-all">{client?.email || 'Archive-Mode'}</p>
                  </div>
                  <div className="space-y-3">
                    <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Target Deadline</p>
                    <input 
                      type="date"
                      disabled={!isAdmin}
                      value={safeISODate(project.deadline)}
                      onChange={async (e) => {
                        const date = new Date(e.target.value);
                        await updateDoc(doc(db, "projects", project.id), { deadline: date });
                      }}
                      className={`w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white focus:border-luxury-accent outline-none cursor-pointer ${!isAdmin && 'opacity-50'}`}
                    />
                  </div>
                </div>

                <div className="mt-16 space-y-6 bg-zinc-950/30 p-8 rounded-3xl border border-zinc-800/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl md:text-2xl font-serif">Project Meta-Notes</h3>
                    {isUpdating && <Loader2 size={16} className="animate-spin text-luxury-accent" />}
                  </div>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    onBlur={updateNotes}
                    placeholder="Capture architectural decisions, private credentials, or high-level goals..."
                    className="w-full h-40 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-sm text-zinc-300 focus:border-luxury-accent outline-none font-light leading-relaxed resize-none transition-all focus:bg-zinc-950"
                  />
                  <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest text-right">Auto-Saving on Focus Lost</p>
                </div>

                <div className="mt-16">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                    <h3 className="text-xl md:text-2xl font-serif flex items-center gap-3">
                      <CheckCircle2 className="text-luxury-accent" size={24} /> Technical Roadmap
                    </h3>
                    <span className="text-[10px] font-bold text-zinc-600 uppercase bg-zinc-950 px-3 py-1 rounded-full border border-zinc-800">
                       {tasks.filter(t => t.isCompleted).length} / {tasks.length} Completed
                    </span>
                  </div>

                  {isAdmin && (
                   <form onSubmit={addTask} className="space-y-4 mb-10">
                       <div className="flex flex-col sm:flex-row gap-4">
                         <input 
                           value={newTask} 
                           onChange={e => setNewTask(e.target.value)}
                           placeholder="Define next sprint milestone..." 
                           className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl px-6 py-4 text-sm focus:border-luxury-accent outline-none transition-all shadow-inner"
                         />
                         <button className="bg-luxury-accent text-luxury-black px-8 py-4 font-bold rounded-2xl hover:bg-white transition-all transform active:scale-95 shadow-lg shadow-luxury-accent/10 w-full sm:w-auto">
                           Append Logic
                         </button>
                       </div>
                       <div className="flex flex-wrap gap-4 items-center">
                         <div className="flex items-center gap-2">
                             <span className="text-[10px] text-zinc-600 font-bold uppercase">Priority:</span>
                             <div className="flex gap-1">
                               {['low', 'medium', 'high'].map(p => (
                                 <button 
                                   key={p}
                                   type="button"
                                   onClick={() => setTaskPriority(p as any)}
                                   className={`px-3 py-1 rounded-full text-[8px] font-bold uppercase border transition-all ${
                                     taskPriority === p ? 'bg-zinc-800 text-white border-zinc-700' : 'text-zinc-600 border-zinc-900 border-transparent'
                                   }`}
                                 >
                                   {p}
                                 </button>
                               ))}
                             </div>
                         </div>
                         <div className="flex items-center gap-2">
                             <span className="text-[10px] text-zinc-600 font-bold uppercase">Assign To:</span>
                             <select 
                               value={taskAssignee}
                               onChange={(e) => setTaskAssignee(e.target.value)}
                               className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1 text-[10px] text-zinc-400 focus:border-luxury-accent outline-none"
                             >
                               <option value="">Unassigned</option>
                               {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                             </select>
                         </div>
                       </div>
                   </form>
                  )}

                  <div className="space-y-4">
                     {tasks.map(task => {
                       const assignee = team.find(m => m.id === task.assignedTo);
                       return (
                         <div 
                           key={task.id} 
                           className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-zinc-950/50 rounded-2xl border border-zinc-800 group hover:border-luxury-accent/20 transition-all gap-4"
                         >
                            <div className="flex items-center gap-5 flex-1">
                             <div 
                               onClick={() => toggleTask(task)}
                               className={`w-6 h-6 rounded-lg border-2 shrink-0 cursor-pointer ${
                                 task.isCompleted ? 'bg-luxury-accent border-luxury-accent' : 'border-zinc-800'
                               } flex items-center justify-center transition-all shadow-sm`}
                             >
                               {task.isCompleted && <CheckCircle2 size={14} className="text-black" />}
                             </div>
                             <div className="space-y-2 flex-1">
                               <span className={`text-sm font-medium transition-all ${task.isCompleted ? 'text-zinc-600 line-through' : 'text-zinc-200'}`}>
                                 {task.title}
                               </span>
                               <div className="flex flex-wrap items-center gap-4">
                                  {/* Priority Toggle */}
                                  <select 
                                   disabled={!isAdmin}
                                   value={task.priority}
                                   onChange={(e) => updateTask(task.id, { priority: e.target.value as any })}
                                   className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded-full border bg-transparent outline-none cursor-pointer ${
                                     task.priority === 'high' ? 'text-red-500 border-red-500/20' : 
                                     task.priority === 'medium' ? 'text-luxury-accent border-luxury-accent/20' : 
                                     'text-zinc-500 border-zinc-800'
                                   } ${!isAdmin && 'pointer-events-none'}`}
                                  >
                                    <option value="low" className="bg-zinc-900 text-zinc-500">Low</option>
                                    <option value="medium" className="bg-zinc-900 text-luxury-accent">Medium</option>
                                    <option value="high" className="bg-zinc-900 text-red-500">High</option>
                                  </select>

                                  {/* Assignee Selection */}
                                  <select 
                                   disabled={!isAdmin}
                                   value={task.assignedTo || ""}
                                   onChange={(e) => updateTask(task.id, { assignedTo: e.target.value || "" })}
                                   className={`bg-transparent border-none text-[10px] text-zinc-500 focus:text-zinc-300 outline-none cursor-pointer flex items-center gap-1 ${!isAdmin && 'pointer-events-none'}`}
                                  >
                                     <option value="" className="bg-zinc-900">Unassigned</option>
                                     {team.map(m => <option key={m.id} value={m.id} className="bg-zinc-900">{m.name}</option>)}
                                  </select>

                                  {/* Due Date */}
                                  <div className="flex items-center gap-2">
                                     <Calendar size={10} className="text-zinc-700" />
                                     <input 
                                       type="date"
                                       disabled={!isAdmin}
                                       value={safeISODate(task.dueDate)}
                                       onChange={(e) => updateTask(task.id, { dueDate: e.target.value ? new Date(e.target.value) : null })}
                                       className={`bg-transparent border-none text-[10px] text-zinc-600 focus:text-zinc-400 outline-none cursor-pointer ${!isAdmin && 'pointer-events-none'}`}
                                     />
                                  </div>
                               </div>
                             </div>
                           </div>
                           {isAdmin && (
                             <button 
                               onClick={() => deleteTask(task.id)}
                               className="self-end sm:self-auto opacity-0 group-hover:opacity-100 p-2 text-zinc-700 hover:text-red-500 transition-all"
                             >
                               <Trash2 size={16} />
                             </button>
                           )}
                         </div>
                       );
                     })}
                     {tasks.length === 0 && (
                       <div className="text-center py-20 border-2 border-dashed border-zinc-800 rounded-3xl">
                          <LayoutDashboard className="mx-auto text-zinc-800 mb-4" size={40} />
                          <p className="text-zinc-600 text-sm font-light">Ecosystem Roadmap is undefined. Add the first milestone to begin.</p>
                       </div>
                     )}
                  </div>
                </div>
             </div>
          </div>
        </div>

        <div className="space-y-10">
           <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-3xl shadow-xl">
              <div className="flex items-baseline justify-between mb-8">
                <h3 className="text-lg font-serif">Client Entity</h3>
                <div className="px-2 py-1 bg-luxury-accent/5 border border-luxury-accent/20 rounded text-[8px] font-bold text-luxury-accent uppercase">Linked</div>
              </div>
              {client ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-5">
                    <div className="w-14 h-14 bg-luxury-accent/10 rounded-full flex items-center justify-center text-luxury-accent shadow-inner border border-luxury-accent/20">
                      <Users size={24} />
                    </div>
                    <div>
                      <p className="text-xl font-serif text-white">{client.name}</p>
                      <div className="flex flex-col gap-1 mt-1">
                        <p className="text-xs text-zinc-500 italic lowercase flex items-center gap-2"><Mail size={10} /> {client.email}</p>
                        {client.phone && <p className="text-xs text-zinc-500 italic flex items-center gap-2"><Phone size={10} /> {client.phone}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="pt-6 space-y-4 border-t border-zinc-800/50">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-zinc-600 uppercase font-bold tracking-widest">Organization</span>
                      <span className="text-zinc-300 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">{client.company || 'Private Party'}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-zinc-600 uppercase font-bold tracking-widest">Lifecycle Phase</span>
                      <span className="text-luxury-accent font-bold tracking-widest">{client.status.toUpperCase()}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => { /* Could navigate to client notes etc */ }}
                    className="w-full py-4 border border-zinc-800 text-[10px] font-bold uppercase tracking-widest text-zinc-500 hover:text-white hover:border-zinc-600 transition-all rounded-xl mt-4"
                  >
                    View CRM Record
                  </button>
                </div>
              ) : (
                <div className="py-8 text-center bg-zinc-950/50 rounded-2xl border border-zinc-800">
                   <AlertCircle className="mx-auto text-zinc-800 mb-2" size={32} />
                   <p className="text-zinc-600 text-xs italic">Broken Link: No client detected.</p>
                </div>
              )}
           </div>

           <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-3xl shadow-xl">
              <h3 className="text-lg font-serif mb-8 flex items-center gap-3">
                <ShieldCheck className="text-luxury-accent" size={18} /> Operational Audit
              </h3>
              <div className="space-y-8 relative pb-4">
                 <div className="absolute left-[7px] top-2 bottom-8 w-px bg-zinc-800"></div>
                 
                 {/* Genesis Milestone */}
                 <div className="flex gap-6 relative">
                    <div className="w-4 h-4 bg-luxury-accent rounded-full border-4 border-zinc-950 z-10 shadow-glow"></div>
                    <div className="space-y-1">
                       <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Genesis</p>
                       <p className="text-xs text-white">Project blueprint initialized.</p>
                       <p className="text-[9px] text-zinc-600">{project.createdAt?.toDate ? project.createdAt.toDate().toLocaleString() : new Date(project.createdAt).toLocaleString()}</p>
                    </div>
                 </div>

                 {/* Phase Milestone */}
                 <div className="flex gap-6 relative">
                    <div className={`w-4 h-4 rounded-full border-4 border-zinc-950 z-10 ${
                      project.status === 'planning' ? 'bg-blue-500' :
                      project.status === 'in-progress' ? 'bg-luxury-accent' :
                      project.status === 'on-hold' ? 'bg-amber-500' :
                      'bg-emerald-500'
                    }`}></div>
                    <div className="space-y-1">
                       <p className={`text-[10px] font-bold uppercase tracking-widest ${
                         project.status === 'planning' ? 'text-blue-500' :
                         project.status === 'in-progress' ? 'text-luxury-accent' :
                         project.status === 'on-hold' ? 'text-amber-500' :
                         'text-emerald-500'
                       }`}>
                         Phase: {project.status.replace('-', ' ').toUpperCase()}
                       </p>
                       <p className="text-xs text-zinc-400">
                         {project.status === 'planning' && "Architecture & scope definition in progress."}
                         {project.status === 'in-progress' && "Active development sprint ongoing."}
                         {project.status === 'on-hold' && "Project resources currently reassigned."}
                         {project.status === 'completed' && "Final deliverables verified & live."}
                       </p>
                    </div>
                 </div>

                 {/* Progress Milestone */}
                 {tasks.length > 0 && (
                   <div className="flex gap-6 relative">
                      <div className={`w-4 h-4 rounded-full border-4 border-zinc-950 z-10 ${tasks.every(t => t.isCompleted) ? 'bg-emerald-500' : 'bg-zinc-700'}`}></div>
                      <div className="space-y-1">
                         <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Milestone Velocity</p>
                         <p className="text-xs text-zinc-400">
                           {tasks.filter(t => t.isCompleted).length} / {tasks.length} logic modules deployed.
                         </p>
                         <div className="w-full h-1 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                            <div 
                              className="h-full bg-luxury-accent transition-all duration-1000" 
                              style={{ width: `${(tasks.filter(t => t.isCompleted).length / tasks.length) * 100}%` }}
                            ></div>
                         </div>
                      </div>
                   </div>
                 )}

                 {/* Pending Action Milestone */}
                 {project.status === 'in-progress' && tasks.some(t => !t.isCompleted) && (
                    <div className="flex gap-6 relative">
                      <div className="w-4 h-4 bg-purple-500 rounded-full border-4 border-zinc-950 z-10 animate-pulse"></div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-purple-500 font-bold uppercase tracking-widest">Awaiting Execution</p>
                        <p className="text-xs text-zinc-400">{tasks.filter(t => !t.isCompleted).length} critical modules remaining in current logic cycle.</p>
                      </div>
                    </div>
                 )}

                 {/* Completion Milestone */}
                 {project.status === 'completed' && (
                    <div className="flex gap-6 relative">
                      <div className="w-4 h-4 bg-emerald-500 rounded-full border-4 border-zinc-950 z-10 shadow-[0_0_10px_rgba(16,185,129,0.3)]"></div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest">System Closure</p>
                        <p className="text-xs text-zinc-300">Operational objectives fully realized.</p>
                      </div>
                    </div>
                 )}

                 <div className="pl-10 text-[9px] text-zinc-700 font-bold uppercase tracking-widest animate-pulse flex items-center gap-2">
                    <div className="w-1 h-1 bg-luxury-accent rounded-full"></div>
                    Real-time sync active...
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function TeamModule({ team, createActivity }: { team: TeamMember[], createActivity: (action: string, targetId?: string, targetType?: string, metadata?: any) => Promise<void> }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, "team"), {
        name, email, phone, role, status: 'available', createdAt: serverTimestamp()
      });
      await createActivity(`Onboarded new Team Member: ${name}`, docRef.id, 'team');
      setName(""); setEmail(""); setPhone(""); setRole(""); setShowAdd(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "team");
    }
  };

  const updateStatus = async (id: string, name: string, status: string) => {
    await updateDoc(doc(db, "team", id), { status });
    await createActivity(`${name} updated status to ${status}`, id, 'team');
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from the core team?`)) return;
    await deleteDoc(doc(db, "team", id));
    await createActivity(`Removed task force member: ${name}`, id, 'team');
  };

  const getPresenceColor = (member: TeamMember) => {
    if (!member.lastActive) return 'bg-zinc-800';
    const lastActive = member.lastActive?.toMillis ? member.lastActive.toMillis() : 0;
    const now = Date.now();
    const diff = now - lastActive;
    if (diff < 60000) return 'bg-emerald-500 animate-pulse'; // active in last minute
    if (diff < 300000) return 'bg-amber-500'; // active in last 5 minutes
    return 'bg-zinc-700';
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-xl font-serif">Core Engineering Team</h3>
          <p className="text-zinc-500 text-xs tracking-widest uppercase">Managed Talent Pool</p>
        </div>
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 bg-luxury-accent text-luxury-black px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-widest"
        >
          <UserPlus size={18} /> Recruit Talent
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.form 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onSubmit={handleAdd}
            className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-6 items-end overflow-hidden"
          >
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-zinc-500">Legal Name</label>
              <input required value={name} onChange={e => setName(e.target.value)} type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-luxury-accent outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-zinc-500">Primary Channel (Email)</label>
              <input required value={email} onChange={e => setEmail(e.target.value)} type="email" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-luxury-accent outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-zinc-500">Specialization (Role)</label>
              <input required value={role} onChange={e => setRole(e.target.value)} type="text" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-luxury-accent outline-none" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-zinc-500">Phone Entry</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} type="tel" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-luxury-accent outline-none" placeholder="+20 ..." />
            </div>
            <div className="md:col-span-4 flex justify-end gap-4 mt-4">
              <button type="button" onClick={() => setShowAdd(false)} className="text-zinc-500 text-xs font-bold uppercase py-3">Abstain</button>
              <button className="bg-white text-black px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest">Onboard</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {team.map(member => (
          <div key={member.id} className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl relative group overflow-hidden">
             <div className="absolute top-0 right-0 w-24 h-24 bg-luxury-accent/5 rounded-bl-full -mr-8 -mt-8 transition-all group-hover:scale-150"></div>
             
             <div className="relative z-10 space-y-6">
                <div className="flex justify-between items-start">
                  <div className="relative">
                    <div className="w-12 h-12 bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center text-luxury-accent">
                      <Users size={20} />
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-zinc-900 ${getPresenceColor(member as any)}`}></div>
                  </div>
                  <select 
                    value={member.status} 
                    onChange={(e) => updateStatus(member.id, member.name, e.target.value)}
                    className={`text-[8px] font-bold uppercase px-2 py-1 rounded border outline-none bg-zinc-950 cursor-pointer ${
                      member.status === 'available' ? 'text-green-500 border-green-500/20' : 
                      member.status === 'busy' ? 'text-amber-500 border-amber-500/20' : 
                      'text-zinc-500 border-zinc-800'
                    }`}
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="away">Away</option>
                  </select>
                </div>

                <div>
                   <h4 className="text-xl font-serif text-white">{member.name}</h4>
                   <p className="text-xs text-luxury-accent font-medium tracking-widest uppercase mt-1">{member.role}</p>
                </div>

                <div className="pt-6 border-t border-zinc-800/50 space-y-3">
                   <div className="flex flex-col">
                      <span className="text-[9px] text-zinc-600 font-bold uppercase">Communications</span>
                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 italic"><Mail size={10} /> {member.email}</div>
                      {member.phone && <div className="flex items-center gap-2 text-[10px] text-zinc-500 italic mt-1"><Phone size={10} /> {member.phone}</div>}
                   </div>
                   <div className="flex justify-end">
                      <button 
                        onClick={() => handleDelete(member.id, member.name)}
                        className="p-2 text-zinc-800 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                   </div>
                </div>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsModule({ projects, clients, team, inquiries, allTasks }: { projects: Project[], clients: Client[], team: TeamMember[], inquiries: Inquiry[], allTasks: Task[] }) {
  const totalRevenue = projects.reduce((acc, p) => acc + (p.budget || 0), 0);
  const avgProjectValue = projects.length ? totalRevenue / projects.length : 0;
  
  const statusCounts = [
    { name: 'Planning', value: projects.filter(p => p.status === 'planning').length, color: '#3b82f6' },
    { name: 'In Progress', value: projects.filter(p => p.status === 'in-progress').length, color: '#c5a358' },
    { name: 'Completed', value: projects.filter(p => p.status === 'completed').length, color: '#10b981' },
    { name: 'On Hold', value: projects.filter(p => p.status === 'on-hold').length, color: '#71717a' },
  ].filter(s => s.value > 0);

  const workloadData = team.map(member => {
    const memberTasks = allTasks.filter(t => t.assignedToEmail === member.email);
    return {
      name: member.name,
      tasks: memberTasks.length,
      completed: memberTasks.filter(t => t.isCompleted).length
    };
  }).sort((a, b) => b.tasks - a.tasks);

  return (
    <div className="space-y-10 pb-20">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-2">
           <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Total Ecosystem Valuation</p>
           <h3 className="text-4xl font-serif text-luxury-accent">${totalRevenue.toLocaleString()}</h3>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-2">
           <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Average Unit Budget</p>
           <h3 className="text-4xl font-serif">${avgProjectValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h3>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-2">
           <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Team Deployment</p>
           <h3 className="text-4xl font-serif">{team.length} <span className="text-sm font-sans text-zinc-600">Active</span></h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-3xl">
           <h4 className="text-xl font-serif mb-10 flex items-center gap-3">
             <PieChartIcon className="text-luxury-accent" size={24} /> Project Lifecycle Distribution
           </h4>
           <div className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusCounts}
                    innerRadius={80}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                  >
                    {statusCounts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px' }}
                  />
                </PieChart>
             </ResponsiveContainer>
           </div>
           <div className="flex flex-wrap gap-6 justify-center mt-6">
              {statusCounts.map(s => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></div>
                  <span className="text-[10px] uppercase font-bold text-zinc-500">{s.name} ({s.value})</span>
                </div>
              ))}
           </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-3xl">
          <h4 className="text-xl font-serif mb-10 flex items-center gap-3">
             <Briefcase className="text-luxury-accent" size={24} /> Engineer Workload
          </h4>
          <div className="space-y-8">
            {workloadData.map(data => (
              <div key={data.name} className="space-y-3">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[13px] font-bold text-zinc-200">{data.name}</p>
                    <p className="text-[10px] text-zinc-500 uppercase tracking-tighter">
                      {data.completed} / {data.tasks} Tasks Finalized
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {data.tasks > 0 ? Math.round((data.completed / data.tasks) * 100) : 0}%
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-950 rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-700" 
                    style={{ width: `${data.tasks > 0 ? (data.completed / data.tasks) * 100 : 0}%` }}
                  ></div>
                  <div 
                    className="h-full bg-luxury-accent/30 transition-all duration-700" 
                    style={{ width: `${data.tasks > 0 ? ((data.tasks - data.completed) / data.tasks) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
            ))}
            {workloadData.length === 0 && <p className="text-center text-zinc-600">No telemetry from the field.</p>}
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-3xl">
        <h4 className="text-xl font-serif mb-6 flex items-center gap-3">
          <TrendingUp className="text-luxury-accent" size={24} /> Engine Efficiency
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
           <ReportMetric label="Client Conversion" val={`${inquiries.length > 0 ? ((clients.length / (inquiries.length + clients.length)) * 100).toFixed(1) : 0}%`} icon={<Award />} />
           <ReportMetric label="Operational Speed" val="High" icon={<Clock />} />
           <ReportMetric label="Inquiry Velocity" val={`${inquiries.length} New`} icon={<TrendingUp />} />
           <ReportMetric label="Project Health" val="98.2%" icon={<ShieldCheck />} />
        </div>
      </div>
    </div>
  );
}

function ReportMetric({ label, val, icon }: { label: string, val: string, icon: any }) {
  return (
    <div className="space-y-4">
      <div className="w-10 h-10 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-center text-luxury-accent">
        {icon}
      </div>
      <div>
        <h4 className="text-2xl font-serif">{val}</h4>
        <p className="text-[10px] text-zinc-600 uppercase font-bold tracking-widest">{label}</p>
      </div>
    </div>
  );
}

// --- Specialized CRM Modules ---

function EngineerWorkspace({ projects, team, user, createActivity }: { projects: Project[], team: TeamMember[], user: any, createActivity: (action: string, targetId?: string, targetType?: string, metadata?: any) => Promise<void> }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  
  useEffect(() => {
    const q = query(collection(db, "tasks"), orderBy("createdAt", "desc"));
    return onSnapshot(q, (snap) => {
      setTasks(snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Task))
        .filter(t => t.assignedTo === user.uid)
      );
    }, (err) => handleFirestoreError(err, OperationType.LIST, "tasks"));
  }, [user.uid]);

  const toggleTask = async (task: Task) => {
    const newState = !task.isCompleted;
    await updateDoc(doc(db, "tasks", task.id), { isCompleted: newState });
    const project = projects.find(p => p.id === task.projectId);
    await createActivity(
      `${newState ? 'Completed' : 'Reopened'} Task: ${task.title} for ${project?.title || 'Unknown Project'}`,
      task.id,
      'task'
    );
  };

  return (
    <div className="space-y-12">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-serif">Hello, Engineer</h2>
          <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest">Active Operations Cycle</p>
        </div>
        <div className="flex gap-4">
           <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 text-center min-w-[120px]">
              <p className="text-2xl font-serif text-amber-500">{tasks.filter(t => !t.isCompleted).length}</p>
              <p className="text-[8px] uppercase font-bold text-zinc-600">Tasks Pending</p>
           </div>
           <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 text-center min-w-[120px]">
              <p className="text-2xl font-serif text-emerald-500">{tasks.filter(t => t.isCompleted).length}</p>
              <p className="text-[8px] uppercase font-bold text-zinc-600">Success Nodes</p>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6">
        <h3 className="text-lg font-serif border-l-2 border-luxury-accent pl-4">Priority Logic Board</h3>
        {tasks.length === 0 ? (
          <div className="py-20 text-center bg-zinc-900 border border-zinc-800 rounded-3xl opacity-50">
             <Clock size={40} className="mx-auto mb-4" />
             <p className="font-light">System idle. No pending assignments detected.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map(task => {
              const project = projects.find(p => p.id === task.projectId);
              return (
                <div key={task.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex items-center justify-between hover:border-luxury-accent/30 transition-all group">
                   <div className="flex items-center gap-6">
                      <div 
                        onClick={() => toggleTask(task)}
                        className={`w-8 h-8 rounded-xl border-2 flex items-center justify-center cursor-pointer transition-all ${
                          task.isCompleted ? 'bg-luxury-accent border-luxury-accent text-black' : 'border-zinc-800'
                        }`}
                      >
                         {task.isCompleted && <CheckCircle2 size={16} />}
                      </div>
                      <div>
                         <h4 className={`text-lg font-medium ${task.isCompleted ? 'text-zinc-600 line-through' : 'text-white'}`}>{task.title}</h4>
                         <span className="text-[10px] text-zinc-500 uppercase font-bold">{project?.title || 'Unknown Project'}</span>
                      </div>
                   </div>
                   <div className="flex items-center gap-8">
                      <div className="hidden sm:block text-right">
                         <p className="text-[10px] text-zinc-500 uppercase font-bold">Priority</p>
                         <p className={`text-xs font-serif ${task.priority === 'high' ? 'text-red-500' : 'text-zinc-400'}`}>{task.priority}</p>
                      </div>
                      <ChevronRight size={18} className="text-zinc-800 group-hover:text-luxury-accent transition-colors" />
                   </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function FinancialsModule({ projects, invoices, createActivity }: { projects: Project[], invoices: Invoice[], createActivity: (action: string, targetId?: string, targetType?: string, metadata?: any) => Promise<void> }) {
  const [showAdd, setShowAdd] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");

  const handleCreateInvoice = async (e: FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, "invoices"), {
      projectId,
      amount: Number(amount),
      status: 'pending',
      dueDate: new Date(dueDate),
      createdAt: serverTimestamp()
    });
    setProjectId(""); setAmount(""); setDueDate(""); setShowAdd(false);
  };

  const totalOutstanding = invoices.filter(i => i.status !== 'paid').reduce((acc, i) => acc + i.amount, 0);

  return (
    <div className="space-y-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl flex justify-between items-center bg-gradient-to-br from-zinc-900 to-zinc-950">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Revenue Pipeline</p>
            <h3 className="text-4xl font-serif text-amber-500 mt-2">${totalOutstanding.toLocaleString()}</h3>
          </div>
          <div className="p-4 bg-amber-500/10 text-amber-500 rounded-2xl"><DollarSign size={24} /></div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl flex justify-between items-center">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">Received Funds</p>
            <h3 className="text-4xl font-serif text-emerald-500 mt-2">
              ${invoices.filter(i => i.status === 'paid').reduce((acc, i) => acc + i.amount, 0).toLocaleString()}
            </h3>
          </div>
          <div className="p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl"><CheckCircle2 size={24} /></div>
        </div>
      </div>

      <div className="flex justify-end">
        <button 
          onClick={() => setShowAdd(!showAdd)}
          className="bg-luxury-accent text-black px-8 py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white transition-all shadow-xl"
        >
          <Plus size={18} className="inline mr-2" /> Issue New Invoice
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.form 
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}
            onSubmit={handleCreateInvoice}
            className="bg-zinc-900 border border-zinc-800 p-10 rounded-3xl grid grid-cols-1 md:grid-cols-3 gap-6 items-end"
          >
            <div className="space-y-2">
               <label className="text-[10px] text-zinc-500 font-bold uppercase">Linked Engine (Project)</label>
               <select required value={projectId} onChange={e => setProjectId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-luxury-accent outline-none">
                  <option value="">Select Target...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
               </select>
            </div>
            <div className="space-y-2">
               <label className="text-[10px] text-zinc-500 font-bold uppercase">Invoice Amount ($)</label>
               <input required type="number" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-luxury-accent outline-none" placeholder="0.00" />
            </div>
            <div className="space-y-2">
               <label className="text-[10px] text-zinc-500 font-bold uppercase">Payment Deadline</label>
               <input required type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-luxury-accent outline-none" />
            </div>
            <div className="md:col-span-3 flex justify-end gap-6 mt-4">
               <button type="button" onClick={() => setShowAdd(false)} className="text-zinc-500 text-xs font-bold uppercase">Abort</button>
               <button className="bg-white text-black px-10 py-3 rounded-xl font-bold text-xs uppercase transition-colors hover:bg-luxury-accent">Deploy Invoice</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <table className="w-full text-left">
           <thead className="bg-zinc-950 text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em]">
              <tr>
                <th className="px-8 py-6">ID / Context</th>
                <th className="px-8 py-6">Financial Value</th>
                <th className="px-8 py-6">Lifecycle Status</th>
                <th className="px-8 py-6">Execution Date</th>
                <th className="px-8 py-6 text-right">Utility</th>
              </tr>
           </thead>
           <tbody className="divide-y divide-zinc-800/50">
              {invoices.map(invoice => {
                const project = projects.find(p => p.id === invoice.projectId);
                return (
                  <tr key={invoice.id} className="hover:bg-zinc-800/20 transition-all group">
                    <td className="px-8 py-6">
                       <p className="font-serif text-lg">{project?.title || 'Unknown Engine'}</p>
                       <p className="text-[8px] text-zinc-500 font-mono mt-1 uppercase tracking-widest">INV-{invoice.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-8 py-6 font-serif text-2xl group-hover:text-luxury-accent transition-colors">${invoice.amount.toLocaleString()}</td>
                    <td className="px-8 py-6">
                       <select 
                        value={invoice.status}
                        onChange={async (e) => await updateDoc(doc(db, "invoices", invoice.id), { status: e.target.value })}
                        className={`bg-transparent text-[10px] font-bold uppercase outline-none cursor-pointer p-2 rounded-lg border border-transparent hover:border-zinc-800 ${
                          invoice.status === 'paid' ? 'text-emerald-500' : 
                          invoice.status === 'overdue' ? 'text-red-500' : 'text-amber-500'
                        }`}
                       >
                         <option value="pending" className="bg-zinc-900">Pending</option>
                         <option value="paid" className="bg-zinc-900">Settled</option>
                         <option value="overdue" className="bg-zinc-900">Overdue</option>
                       </select>
                    </td>
                    <td className="px-8 py-6 text-xs text-zinc-500 font-mono uppercase italic">
                      {invoice.dueDate?.seconds ? new Date(invoice.dueDate.seconds * 1000).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-8 py-6 text-right">
                       <button onClick={async () => {
                         if(confirm("Permanently erase financial record?")) await deleteDoc(doc(db, "invoices", invoice.id));
                       }} className="p-3 text-zinc-800 hover:text-red-500 transition-all hover:scale-110"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                );
              })}
           </tbody>
        </table>
        {invoices.length === 0 && (
          <div className="py-20 text-center text-zinc-600 font-serif italic text-lg opacity-40">No billing events captured.</div>
        )}
      </div>
    </div>
  );
}

function ProfileView({ user, userProfile, createActivity }: { user: any, userProfile: UserProfile | null, createActivity: (action: string, targetId?: string, targetType?: string, metadata?: any) => Promise<void> }) {
  const [name, setName] = useState(user.displayName || "");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<any>(null);
  
  // Broadcast state
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  const handleBroadcast = async (e: FormEvent) => {
    e.preventDefault();
    if (!broadcastMessage) return;
    setIsBroadcasting(true);
    try {
      await addDoc(collection(db, "notifications"), {
        role: 'engineer',
        title: "OFFICIAL_BROADCAST",
        message: broadcastMessage,
        senderName: userProfile?.name,
        type: 'broadcast',
        read: false,
        createdAt: serverTimestamp()
      });
      await createActivity(`Issued Global Broadcast: ${broadcastMessage.slice(0, 30)}...`, 'system', 'broadcast');
      setBroadcastMessage("");
      alert("Broadcast transmitted successfully.");
    } catch (e: any) {
      alert("Broadcast failure: " + e.message);
    } finally {
      setIsBroadcasting(false);
    }
  };

  // New password state
  const [newPassword, setNewPassword] = useState("");
  const [isSettingPassword, setIsSettingPassword] = useState(false);

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    setIsUpdating(true);
    try {
      await updateProfile(user, { displayName: name });
      await updateDoc(doc(db, "users", user.uid), { name });
      alert("Executive profile synchronized successfully.");
    } catch (e: any) {
      alert("Synch failure: " + e.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) return alert("Security protocols require at least 6 characters.");
    setIsSettingPassword(true);
    try {
      await updatePassword(user, newPassword);
      alert("Manual access credentials established. You can now use this password to login.");
      setNewPassword("");
    } catch (e: any) {
      if (e.code === 'auth/requires-recent-login') {
        alert("Security timeout: Please logout and login again via Google before setting a password.");
      } else {
        alert("Credential failure: " + e.message);
      }
    } finally {
      setIsSettingPassword(false);
    }
  };

  const runBootstrap = async () => {
    if (!confirm("This will configure default passwords for admin accounts. Proceed?")) return;
    setIsBootstrapping(true);
    setBootstrapResult(null);
    try {
      const res = await fetch("/api/system/bootstrap", { method: "POST" });
      const data = await res.json();
      setBootstrapResult(data);
    } catch (e) {
      setBootstrapResult({ error: "System gateway connection failure." });
    } finally {
      setIsBootstrapping(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-12 pb-20">
       <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-3xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-luxury-accent/5 rounded-full -mr-32 -mt-32 blur-3xl"></div>
          
          <div className="relative z-10 space-y-10">
             <div className="flex items-center gap-8">
                <div className="w-24 h-24 bg-zinc-950 rounded-3xl p-1 border border-zinc-800 relative group cursor-pointer overflow-hidden">
                   {user.photoURL ? (
                     <img src={user.photoURL} alt="" className="w-full h-full rounded-2xl object-cover" />
                   ) : (
                     <div className="w-full h-full bg-luxury-accent/10 rounded-2xl flex items-center justify-center text-luxury-accent">
                        <UserCircle size={48} strokeWidth={1} />
                     </div>
                   )}
                   <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Plus size={24} />
                   </div>
                </div>
                <div>
                   <h3 className="text-3xl font-serif">{name || "Administrator"}</h3>
                   <p className="text-zinc-500 font-mono text-sm lowercase">{user.email}</p>
                   <div className="flex gap-2 mt-3">
                      <span className="px-2 py-0.5 bg-luxury-accent/10 text-luxury-accent border border-luxury-accent/20 rounded text-[9px] font-bold uppercase tracking-widest">
                        {userProfile?.role || 'Engineer'}
                      </span>
                      {ADMIN_EMAILS.includes(user.email!) && userProfile?.role !== 'admin' && (
                        <button 
                          onClick={async () => {
                            await updateDoc(doc(db, "users", user.uid), { role: 'admin' });
                            alert("Privileges escalated. System refreshing...");
                          }}
                          className="px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded text-[9px] font-bold uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                        >
                          Verify Admin Status
                        </button>
                      )}
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded text-[9px] font-bold uppercase tracking-widest">
                        Verified Access
                      </span>
                   </div>
                </div>
             </div>

             <form onSubmit={handleUpdateProfile} className="space-y-6 pt-10 border-t border-zinc-800/50">
                <div className="space-y-2">
                   <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Profile Identity</label>
                   <input 
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-luxury-accent outline-none font-medium transition-all"
                   />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="space-y-2 opacity-50">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Global Protocol (Email)</label>
                      <input 
                        disabled
                        value={user.email || ""}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-mono truncate"
                      />
                   </div>
                   <div className="space-y-2 opacity-50">
                      <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Assigned Privilege</label>
                      <input 
                        disabled
                        value={userProfile?.role === 'admin' ? "System Architect" : "Ecosystem Engineer"}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm font-medium"
                      />
                   </div>
                </div>

                <div className="pt-6">
                   <button 
                    disabled={isUpdating}
                    className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-luxury-accent transition-all flex items-center justify-center gap-2 transform active:scale-[0.98]"
                   >
                     {isUpdating ? <Loader2 className="animate-spin" size={18} /> : <ShieldCheck size={18} />}
                     Synchronize Core Records
                   </button>
                </div>
             </form>
             
             {/* New Manual Credential Section */}
             <form onSubmit={handleSetPassword} className="space-y-6 pt-10 border-t border-zinc-800/50">
                <div className="space-y-2">
                   <label className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Manual Login Protocol (Set Password)</label>
                   <p className="text-[10px] text-zinc-600 mb-2 italic">Essential for bypassing Google auth in production environments.</p>
                   <div className="flex gap-4">
                      <input 
                        type="password"
                        placeholder="New Secure Password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-luxury-accent outline-none font-medium transition-all"
                      />
                      <button 
                        disabled={isSettingPassword || !newPassword}
                        className="px-6 py-3 bg-zinc-800 text-white rounded-xl text-xs font-bold uppercase hover:bg-luxury-accent hover:text-black transition-all disabled:opacity-50"
                      >
                        {isSettingPassword ? <Loader2 className="animate-spin" size={16} /> : "Update"}
                      </button>
                   </div>
                </div>
             </form>
          </div>
       </div>

       {userProfile?.role === 'admin' && (
          <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-3xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div>
               <h3 className="text-xl font-serif mb-2">System Infrastructure Hub</h3>
               <p className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Administrative logic & security bootstrapping</p>
             </div>
             
             <div className="p-6 bg-zinc-950 rounded-2xl border border-zinc-800/50 space-y-6">
                <div className="flex justify-between items-start">
                   <div className="space-y-2">
                      <h4 className="text-sm font-medium">Access Synchronization</h4>
                      <p className="text-xs text-zinc-600 leading-relaxed max-w-sm">
                        Resets or initializes admin passwords to the organizational standard (<span className="text-luxury-accent font-bold">admin123</span>).
                      </p>
                   </div>
                   <button 
                    onClick={runBootstrap}
                    disabled={isBootstrapping}
                    className="px-6 py-2 bg-zinc-900 border border-zinc-700 text-[10px] font-bold uppercase tracking-widest rounded-lg hover:border-luxury-accent transition-all disabled:opacity-50"
                   >
                     {isBootstrapping ? "Executing..." : "Run Bootstrap"}
                   </button>
                </div>

                {bootstrapResult && (
                   <div className="mt-4 p-4 bg-zinc-900 rounded-xl border border-zinc-800 font-mono text-[10px] space-y-2 max-h-40 overflow-auto">
                      <p className="text-luxury-accent"># BOOTSTRAP_LOG</p>
                      {bootstrapResult.results?.map((r: any, i: number) => (
                        <p key={i} className={r.status === 'failed' ? 'text-red-500' : 'text-emerald-500'}>
                          [{r.status.toUpperCase()}] {r.email}: {r.error || 'SUCCESS'}
                        </p>
                      ))}
                      {bootstrapResult.error && <p className="text-red-500">! ERROR: {bootstrapResult.error}</p>}
                   </div>
                )}
             </div>

             {/* Broadcast Section */}
             <div className="bg-zinc-900 border border-zinc-800 p-10 rounded-3xl space-y-8">
                <div className="space-y-2">
                  <h3 className="text-xl font-serif flex items-center gap-3">
                    <Zap className="text-luxury-accent" size={24} /> Strategic Broadcast
                  </h3>
                  <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest">Global Telemetry Link</p>
                </div>

                <div className="flex gap-4">
                  <input 
                    type="text" 
                    value={broadcastMessage}
                    onChange={(e) => setBroadcastMessage(e.target.value)}
                    placeholder="Enter directive for all field operatives..."
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-6 py-4 outline-none focus:border-luxury-accent/50 transition-all font-mono text-xs"
                  />
                  <button 
                    onClick={handleBroadcast}
                    disabled={isBroadcasting || !broadcastMessage}
                    className="px-8 bg-white text-black font-bold rounded-xl hover:bg-luxury-accent transition-all text-xs active:scale-95 disabled:opacity-50"
                  >
                    {isBroadcasting ? <Loader2 className="animate-spin" size={18} /> : "Transmit"}
                  </button>
                </div>
             </div>

             <div className="flex items-center gap-4 p-6 border-2 border-dashed border-zinc-800 rounded-2xl opacity-40 grayscale">
                <Cpu className="text-zinc-700" size={32} />
                <div>
                   <p className="text-sm font-bold uppercase tracking-widest text-zinc-600">Advanced Telemetry</p>
                   <p className="text-xs text-zinc-700 italic">Phase 2 integration pending.</p>
                </div>
             </div>
          </div>
       )}
    </div>
  );
}
