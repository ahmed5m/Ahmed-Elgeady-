/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, useScroll, useTransform, AnimatePresence, useSpring } from "motion/react";
import { 
  Github, 
  Linkedin, 
  Mail, 
  MapPin, 
  Phone, 
  ExternalLink, 
  Code2, 
  Server, 
  Database, 
  Layers, 
  ChevronRight,
  Menu,
  X,
  CheckCircle2,
  Cpu,
  Sparkles
} from "lucide-react";
import { useState, useRef, useEffect, ReactNode, FormEvent } from "react";
import Lenis from "lenis";
import { db, handleFirestoreError, OperationType } from "./lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { Loader2, CheckCircle } from "lucide-react";
import { 
  BrowserRouter as Router, 
  Routes, 
  Route 
} from "react-router-dom";
import Dashboard from "./components/Dashboard";

// --- Types ---
interface Project {
  title: string;
  url: string;
  description: string;
  tags: string[];
}

interface Skill {
  category: string;
  items: string[];
  icon: ReactNode;
}

// --- Data ---
const PROJECTS: Project[] = [
  {
    title: "Saeed Al-Dahmani - Law Firm",
    url: "https://saeedaldahmanii.com/",
    description: "Developed a secure backend and dashboard using Laravel for a prominent law firm, focusing on legal data management and client reporting.",
    tags: ["Laravel", "MySQL", "Dashboard", "Auth"]
  },
  {
    title: "Salah Al-Mubashri - Legal Consultancy",
    url: "https://mublegal.com/",
    description: "High-performance consultancy platform with a custom CMS and RESTful API integration for managing legal services.",
    tags: ["PHP", "Laravel", "REST API", "Database Design"]
  },
  {
    title: "Student Management System",
    url: "#",
    description: "A comprehensive platform for schools to manage student data, course enrollment, and attendance records using Laravel.",
    tags: ["PHP", "Laravel", "Management", "Scalable"]
  },
  {
    title: "Sanay3y Service Marketplace",
    url: "#",
    description: "A marketplace connecting service providers with customers. Features complex auth, booking logic, and real-time AJAX interactions.",
    tags: ["Laravel", "AJAX", "E-commerce", "Auth"]
  },
  {
    title: "E-Commerce Platform",
    url: "#",
    description: "Full-stack development for product management, secure cart transactions, and order processing flows.",
    tags: ["Laravel", "MySQL", "E-commerce", "Security"]
  }
];

const SKILLS: Skill[] = [
  {
    category: "Backend Mastery",
    items: ["PHP", "Laravel", "RESTful APIs", "MVC Architecture", "Auth Handling"],
    icon: <Server className="w-6 h-6 text-luxury-accent" />
  },
  {
    category: "Data Integrity",
    items: ["MySQL", "Database Design", "Indexing", "Query Optimization"],
    icon: <Database className="w-6 h-6 text-luxury-accent" />
  },
  {
    category: "Frontend & UI",
    items: ["HTML5", "CSS3", "JavaScript", "jQuery", "AJAX", "Bootstrap"],
    icon: <Code2 className="w-6 h-6 text-luxury-accent" />
  },
  {
    category: "Architecture & CMS",
    items: ["WordPress", "Git", "Dashboard Development", "API Integration"],
    icon: <Layers className="w-6 h-6 text-luxury-accent" />
  }
];

// --- Components ---

const CustomCursor = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const cursorX = useSpring(position.x, { damping: 20, stiffness: 300 });
  const cursorY = useSpring(position.y, { damping: 20, stiffness: 300 });

  useEffect(() => {
    const moveCursor = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleHover = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      setIsHovering(!!target.closest('a, button, .group'));
    };

    window.addEventListener('mousemove', moveCursor);
    window.addEventListener('mouseover', handleHover);
    return () => {
      window.removeEventListener('mousemove', moveCursor);
      window.removeEventListener('mouseover', handleHover);
    };
  }, []);

  return (
    <motion.div 
      className="fixed top-0 left-0 w-8 h-8 border border-luxury-accent rounded-full pointer-events-none z-[10000] mix-blend-difference flex items-center justify-center"
      style={{
        x: cursorX,
        y: cursorY,
        translateX: "-50%",
        translateY: "-50%",
        scale: isHovering ? 2.5 : 1,
      }}
      transition={{ type: "spring", damping: 30, stiffness: 200 }}
    >
      <div className="w-1 h-1 bg-luxury-accent rounded-full" />
    </motion.div>
  );
};

const SystemVisualizer = () => {
  return (
    <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden flex items-center justify-center">
      <motion.div 
        animate={{ rotate: 360 }}
        transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
        className="relative w-[150vw] h-[150vw] border-[0.5px] border-luxury-accent/30 rounded-full flex items-center justify-center"
      >
        <div className="w-[100vw] h-[100vw] border-[0.5px] border-luxury-accent/20 rounded-full flex items-center justify-center">
           <div className="w-[60vw] h-[60vw] border-[0.5px] border-luxury-accent/10 rounded-full" />
        </div>
        {[...Array(8)].map((_, i) => (
          <div 
            key={i} 
            className="absolute top-1/2 left-1/2 w-full h-[0.5px] bg-luxury-accent/5"
            style={{ transform: `translate(-50%, -50%) rotate(${i * 45}deg)` }}
          />
        ))}
      </motion.div>
    </div>
  );
};

const ProjectCard = ({ project }: { project: Project, key?: any }) => {
  const cardRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: cardRef,
    offset: ["start end", "end start"]
  });

  const parallaxY = useTransform(scrollYProgress, [0, 1], [-40, 40]);

  return (
    <motion.div 
      ref={cardRef}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      viewport={{ once: true }}
      className="group cursor-pointer relative"
    >
      <div className="relative aspect-video bg-luxury-black overflow-hidden mb-6 flex items-center justify-center">
        {/* Parallax Background */}
        <motion.div 
          style={{ y: parallaxY }}
          className="absolute inset-x-0 h-[150%] flex items-center justify-center opacity-10 pointer-events-none select-none"
        >
          <span className="text-white font-serif text-[15vw] uppercase whitespace-nowrap">
            {project.title.split(' ')[0]}
          </span>
        </motion.div>

        <div className="absolute inset-0 bg-luxury-accent/5 backdrop-blur-[1px] opacity-0 group-hover:opacity-100 transition-all duration-500 z-10" />
        
        {/* View Case Study Button Overlay */}
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileHover={{ scale: 1.05 }}
            className="opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-4 transition-all duration-500"
          >
            <a 
              href="#"
              className="bg-white text-luxury-black px-8 py-4 text-[10px] uppercase font-bold tracking-[0.2em] shadow-2xl hover:bg-luxury-accent hover:text-white transition-colors"
            >
              View Project
            </a>
          </motion.div>
        </div>

        <a 
          href={project.url} 
          target="_blank" 
          rel="noreferrer"
          className="absolute bottom-6 right-6 p-4 bg-white text-luxury-black rounded-full opacity-0 group-hover:opacity-100 translate-y-4 group-hover:translate-y-0 transition-all z-30 shadow-lg"
        >
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>

      <motion.div 
        className="space-y-3 relative z-10"
        whileHover={{ x: 10 }}
        transition={{ type: "spring", stiffness: 200 }}
      >
        <div className="flex gap-2 mb-2">
          {project.tags.map(tag => (
            <span key={tag} className="text-[10px] uppercase tracking-widest text-luxury-accent border border-luxury-accent/30 px-2 py-0.5 font-bold">
              {tag}
            </span>
          ))}
        </div>
        <h3 className="text-2xl font-serif group-hover:text-luxury-accent transition-colors leading-tight">
          {project.title}
        </h3>
        <p className="text-luxury-gray/60 leading-relaxed text-sm max-w-lg font-light">
          {project.description}
        </p>
      </motion.div>
    </motion.div>
  );
};

const SectionHeader = ({ title, subtitle }: { title: string; subtitle: string }) => {
  return (
  <div className="mb-16 space-y-4">
    <motion.span 
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6 }}
      className="inline-block px-4 py-1 text-xs tracking-[0.3em] uppercase border border-luxury-accent/30 text-luxury-accent"
    >
      {subtitle}
    </motion.span>
    <motion.h2 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="text-4xl md:text-5xl lg:text-6xl font-serif tracking-tight"
    >
      {title}
    </motion.h2>
  </div>
  );
};

const ContactForm = () => {
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", description: "" });
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.description) return;

    setStatus('submitting');
    try {
      const response = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('API request failed');

      setStatus('success');
      setFormData({ name: "", email: "", phone: "", description: "" });
    } catch (error) {
      console.error('Contact error:', error);
      setStatus('error');
    }
  };

  return (
    <div className="p-8 md:p-12 border border-white/10 bg-white/5 backdrop-blur-xl space-y-6 relative group overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-luxury-accent/10 blur-3xl group-hover:bg-luxury-accent/20 transition-colors pointer-events-none" />
      <h3 className="text-3xl font-serif text-white tracking-tight">Project Inquiry</h3>
      
      <AnimatePresence mode="wait">
        {status === 'success' ? (
          <motion.div 
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center justify-center py-12 text-center space-y-4"
          >
            <div className="w-16 h-16 bg-luxury-accent/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-luxury-accent" />
            </div>
            <h4 className="text-xl font-serif text-white">Message Architected</h4>
            <p className="text-white/40 text-sm max-w-[240px]">Integration successful. I will review your requirements and respond shortly.</p>
            <button 
              onClick={() => setStatus('idle')}
              className="text-xs uppercase tracking-widest text-luxury-accent font-bold pt-4 hover:underline"
            >
              Send Another Inquiry
            </button>
          </motion.div>
        ) : (
          <motion.form 
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-6" 
            onSubmit={handleSubmit}
          >
            <div className="space-y-1 group">
               <label className="text-[10px] uppercase tracking-widest text-white/30 font-bold group-focus-within:text-luxury-accent transition-colors">Full Name</label>
               <input 
                required
                type="text" 
                placeholder="John Doe" 
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full bg-transparent border-b border-white/10 py-3 text-white focus:outline-none focus:border-luxury-accent transition-colors" 
               />
            </div>
            <div className="space-y-1 group">
               <label className="text-[10px] uppercase tracking-widest text-white/30 font-bold group-focus-within:text-luxury-accent transition-colors">Email Address</label>
               <input 
                required
                type="email" 
                placeholder="john@example.com" 
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className="w-full bg-transparent border-b border-white/10 py-3 text-white focus:outline-none focus:border-luxury-accent transition-colors" 
               />
            </div>
            <div className="space-y-1 group">
               <label className="text-[10px] uppercase tracking-widest text-white/30 font-bold group-focus-within:text-luxury-accent transition-colors">Phone Number (Optional)</label>
               <input 
                type="tel" 
                placeholder="+20 ..." 
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className="w-full bg-transparent border-b border-white/10 py-3 text-white focus:outline-none focus:border-luxury-accent transition-colors" 
               />
            </div>
            <div className="space-y-1 group">
               <label className="text-[10px] uppercase tracking-widest text-white/30 font-bold group-focus-within:text-luxury-accent transition-colors">Project Brief</label>
               <textarea 
                required
                rows={3} 
                placeholder="Describe your architectural vision..." 
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full bg-transparent border border-white/10 p-4 text-white focus:outline-none focus:border-luxury-accent transition-colors mt-2" 
               />
            </div>
            {status === 'error' && (
              <p className="text-red-400 text-[10px] uppercase tracking-widest font-bold">Transmission failure. Please try again.</p>
            )}
            <button 
              disabled={status === 'submitting'}
              className="w-full py-5 bg-luxury-accent text-luxury-black text-xs uppercase tracking-[0.3em] font-bold hover:bg-white transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {status === 'submitting' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Submit Inquiry"
              )}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
};

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomeView />} />
        <Route path="/admin" element={<Dashboard />} />
      </Routes>
    </Router>
  );
}

function HomeView() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    document.documentElement.dir = "ltr";
    document.documentElement.lang = "en";
    document.title = "Ahmed El-Jaidi | Senior PHP & Laravel Backend Architect";
  }, []);
  
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    // Cinematic loading sequence
    const timer = setTimeout(() => setIsLoading(false), 2500);

    return () => {
      lenis.destroy();
      clearTimeout(timer);
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      dir="ltr"
      className="relative min-h-screen luxury-grid selection:bg-luxury-accent/20 cursor-none font-sans"
    >
      <AnimatePresence>
        {isLoading && (
          <motion.div 
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ 
              y: "-100%",
              transition: { duration: 1.2, ease: [0.76, 0, 0.24, 1], delay: 0.2 } 
            }}
            className="fixed inset-0 z-[20000] bg-luxury-black flex items-center justify-center overflow-hidden"
          >
            {/* Architectural Grid Background for Loader */}
            <div className="absolute inset-0 opacity-20 pointer-events-none">
              <div className="h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
            </div>

            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="relative p-12 md:p-24 flex flex-col items-center"
            >
              <div className="overflow-hidden mb-4">
                <motion.h2 
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                  className="text-white text-7xl md:text-9xl font-serif tracking-tighter"
                >
                  EL-JAIDI
                </motion.h2>
              </div>

              <div className="flex flex-col items-center gap-4">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: 300 }}
                  transition={{ duration: 1.5, ease: "circIn", delay: 0.5 }}
                  className="h-[1px] bg-luxury-accent/50 w-full"
                />
                
                <div className="overflow-hidden">
                  <motion.div 
                    initial={{ y: "110%" }}
                    animate={{ y: 0 }}
                    transition={{ duration: 1, delay: 0.8 }}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className="text-luxury-accent text-[12px] md:text-[14px] uppercase tracking-[0.6em] font-light">
                      Senior Backend Architect
                    </span>
                    <span className="text-white/20 text-[8px] uppercase tracking-[0.4em] font-mono mt-2">
                      Initializing Logic Engine v4.0.2
                    </span>
                  </motion.div>
                </div>
              </div>

              {/* Progress Detail */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.2 }}
                className="mt-12 flex items-center gap-4 text-white/40 text-[10px] font-mono uppercase tracking-[0.3em]"
              >
                <div className="flex gap-1">
                  {[...Array(3)].map((_, i) => (
                    <motion.div 
                      key={i}
                      animate={{ opacity: [0.2, 1, 0.2] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                      className="w-1 h-1 bg-luxury-accent rounded-full"
                    />
                  ))}
                </div>
                <span>Securing Environment</span>
              </motion.div>
            </motion.div>
            
            {/* Visual Borders */}
            <motion.div 
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.5, ease: "circIn" }}
              className="absolute top-12 inset-x-12 h-[1px] bg-white/10 origin-left"
            />
            <motion.div 
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 1.5, ease: "circIn", delay: 0.1 }}
              className="absolute bottom-12 inset-x-12 h-[1px] bg-white/10 origin-right"
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grain-overlay" />
      <CustomCursor />
      
      {/* Scroll Progress Bar */}
      <motion.div 
        className="fixed top-0 left-0 right-0 h-[2px] bg-luxury-accent origin-left z-[100]"
        style={{ scaleX: scrollYProgress }}
      />
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 md:px-12 py-8 bg-white/80 backdrop-blur-md border-b border-black/5">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xl font-serif tracking-tight flex items-center gap-4"
        >
          <div className="flex items-baseline gap-2">
            <span className="font-extrabold uppercase">Ahmed</span>
            <span className="text-luxury-accent font-light">El-Jaidi</span>
          </div>
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-green-500/5 border border-green-500/20 rounded-full">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[8px] uppercase tracking-widest font-bold text-green-600/70">Server: Online</span>
          </div>
        </motion.div>

        <div className="hidden md:flex gap-12 items-center">
          {["Services", "Work", "About", "Contact"].map((item, i) => (
            <a 
              key={item} 
              href={`#${item.toLowerCase()}`} 
              className="text-xs uppercase tracking-widest font-medium hover:text-luxury-accent transition-colors"
            >
              {item}
            </a>
          ))}
          <a 
            href="#contact" 
            className="px-6 py-2 bg-luxury-black text-white text-xs uppercase tracking-widest hover:bg-luxury-gray transition-colors"
          >
            Hire Me
          </a>
          <a 
            href="/admin" 
            className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 hover:text-luxury-accent transition-colors"
          >
            Terminal
          </a>
        </div>

        <button className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? <X /> : <Menu />}
        </button>
      </nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div 
            initial={{ clipPath: "circle(0% at 100% 0%)" }}
            animate={{ clipPath: "circle(150% at 100% 0%)" }}
            exit={{ clipPath: "circle(0% at 100% 0%)" }}
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
            className="fixed inset-0 bg-luxury-black text-white z-[60] p-12 flex flex-col justify-center gap-6 md:hidden"
          >
            <div className="absolute top-12 right-12">
              <button 
                onClick={() => setIsMenuOpen(false)} 
                className="p-4 border border-white/10 rounded-full hover:bg-luxury-accent hover:border-luxury-accent transition-all active:scale-90"
              >
                <X className="w-8 h-8" />
              </button>
            </div>
            
            <div className="space-y-4">
              <span className="text-[10px] uppercase tracking-[0.4em] text-luxury-accent font-bold mb-4 block">Navigation</span>
              {["Services", "Work", "About", "Contact", "Terminal"].map((item, i) => (
                <motion.div
                  initial={{ x: 50, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 + (i * 0.1) }}
                  key={item}
                >
                  <a 
                    href={item === "Terminal" ? "/admin" : `#${item.toLowerCase()}`}
                    onClick={() => setIsMenuOpen(false)}
                    className="text-6xl font-serif tracking-tighter hover:text-luxury-accent transition-colors block"
                  >
                    {item}
                  </a>
                </motion.div>
              ))}
            </div>
            
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-12 pt-12 border-t border-white/5"
            >
              <a 
                href="#contact" 
                onClick={() => setIsMenuOpen(false)}
                className="w-full block py-6 bg-luxury-accent text-luxury-black text-sm uppercase tracking-[0.3em] font-bold text-center hover:bg-white transition-colors"
              >
                Start a Project
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero Section */}
      <section className="relative h-screen flex flex-col justify-center px-6 md:px-12 lg:px-24 overflow-hidden pt-20">
        <SystemVisualizer />
        
        <div className="max-w-7xl mx-auto w-full relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, ease: "circOut" }}
            className="relative"
          >
            <motion.span 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
              className="inline-block px-4 py-1 text-xs tracking-[0.3em] uppercase bg-luxury-black text-white mb-6"
            >
              Senior Backend Architect
            </motion.span>
            <h1 className="text-5xl md:text-8xl lg:text-9xl font-serif leading-[0.9] tracking-tighter">
              CRAFTING <br />
              <motion.span 
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 2, repeat: Infinity, repeatType: "reverse" }}
                className="text-luxury-accent italic"
              >
                ARCHITECTURE
              </motion.span> <br />
              THAT SCALES.
            </h1>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8, duration: 1 }}
            className="mt-12 flex flex-col md:flex-row gap-12 items-start md:items-center justify-between"
          >
            <div className="relative group">
              <motion.div 
                animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className={`absolute -left-12 -top-12 w-24 h-24 border border-dashed border-luxury-accent/30 rounded-full pointer-events-none`}
              />
              <p className={`max-w-md text-luxury-gray/70 text-base md:text-lg leading-relaxed border-l-2 pl-6 border-luxury-accent font-light`}>
                Ahmed Mohamed El-Jaidi. A PHP & Laravel Architect specialized in high-performance backend systems and enterprise-grade security.
              </p>
            </div>
            <div className="flex gap-6">
              {[Github, Linkedin, Mail].map((Icon, i) => (
                <motion.a 
                  key={i}
                  whileHover={{ y: -5, color: "#c5a358" }}
                  href="#" 
                  className="p-3 border border-black/10 rounded-full transition-colors"
                >
                  <Icon className="w-5 h-5" />
                </motion.a>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2, duration: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
        >
          <span className="text-[8px] uppercase tracking-[0.5em] text-luxury-gray/40 font-bold">Scroll to Explore</span>
          <motion.div 
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-[1px] h-12 bg-gradient-to-b from-luxury-accent to-transparent"
          />
        </motion.div>

        {/* Decorative elements */}
        <motion.div 
          style={{ y: backgroundY }}
          className="absolute right-0 bottom-0 w-1/3 aspect-square border-l border-t border-black/5 -mr-12 -mb-12 pointer-events-none"
        />
      </section>

      {/* Services / Philosophy */}
      <section id="services" className="py-32 px-6 md:px-12 lg:px-24 bg-luxury-black text-white relative">
        <div className={`absolute top-0 right-12 text-[10vw] font-serif opacity-5 select-none text-luxury-accent`}>
          LOGIC
        </div>
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="Technical Excellence" subtitle="Vision & Strategy" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {SKILLS.map((skill, index) => (
              <motion.div 
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="p-8 border border-white/10 flex flex-col gap-6 hover:border-luxury-accent/50 transition-colors group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-[2px] bg-luxury-accent transition-transform duration-500 -translate-x-full group-hover:translate-x-0" />
                <div className="p-3 bg-white/5 w-fit rounded-lg group-hover:bg-luxury-accent/20 transition-colors">
                  {skill.icon}
                </div>
                <h3 className="text-xl font-serif">{skill.category}</h3>
                <ul className="space-y-3">
                  {skill.items.map((item, i) => (
                    <li key={i} className="text-sm text-white/50 flex items-center gap-2 group-hover:text-white transition-colors">
                      <ChevronRight className="w-3 h-3 text-luxury-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack Marquee Section */}
      <section className="py-20 bg-white border-y border-black/5 overflow-hidden">
        <div className="flex flex-col items-center mb-12">
           <span className="text-[10px] uppercase tracking-[0.4em] text-luxury-accent font-bold mb-2">Core Technologies</span>
           <h3 className="text-3xl font-serif">Command Center</h3>
        </div>
        <div className="flex gap-12 animate-marquee whitespace-nowrap px-6">
          {[
            "PHP 8.3", "Laravel 11", "MySQL 8", "Redis", "Docker", "REST APIs", 
            "MVC Architecture", "JWT Auth", "PostgreSQL", "Unit Testing", "Eloquent ORM",
            "PHP 8.3", "Laravel 11", "MySQL 8", "Redis", "Docker", "REST APIs",
            "MVC Architecture", "JWT Auth", "PostgreSQL", "Unit Testing", "Eloquent ORM"
          ].map((tech, i) => (
            <div key={i} className="text-4xl md:text-7xl font-serif text-luxury-black/10 hover:text-luxury-accent transition-all duration-700 cursor-default select-none group relative">
              {tech}
              <div className="absolute -bottom-2 left-0 w-0 h-[1px] bg-luxury-accent transition-all duration-700 group-hover:w-full" />
            </div>
          ))}
        </div>
      </section>

      {/* Work / Portfolio */}
      <section id="work" className="py-32 px-6 md:px-12 lg:px-24 border-b border-black/5">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="Selected Commissions" subtitle="The Portfolio" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-x-12 lg:gap-y-24">
            {PROJECTS.map((project, index) => (
              <ProjectCard key={index} project={project} />
            ))}
          </div>
        </div>
      </section>

      {/* Custom Backend Visualizer Section */}
      <section className="py-32 px-6 md:px-12 lg:px-24 bg-luxury-black/5 relative overflow-hidden">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
            <div className="space-y-8">
                <SectionHeader title="System Architecture" subtitle="How I Think" />
                <p className="text-luxury-gray text-lg leading-relaxed font-light">
                    My approach is rooted in clean architecture. I treat code like a structural blueprint—authoritative, efficient, and built to withstand load. From normalization to orchestration, every line has its place.
                </p>
                <div className="grid grid-cols-3 gap-8">
                    {[
                        { label: "Stability", val: "99.9%" },
                        { label: "Efficiency", val: "O(log n)" },
                        { label: "Security", val: "Auth Guard" }
                    ].map((stat, i) => (
                        <div key={i} className="space-y-2">
                             <div className="text-2xl font-serif text-luxury-accent">{stat.val}</div>
                             <div className="text-[10px] uppercase tracking-widest text-luxury-gray/50 font-bold">{stat.label}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="relative aspect-square flex items-center justify-center">
                 <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                    className="w-full h-full border border-luxury-accent/20 rounded-full flex items-center justify-center p-12 border-dashed"
                 >
                    <div className="w-full h-full border border-luxury-black/10 rounded-full flex items-center justify-center">
                         <Cpu className="w-16 h-16 text-luxury-accent opacity-20" />
                    </div>
                 </motion.div>
                 {/* Internal logic dots */}
                 <div className="absolute inset-0 flex items-center justify-center">
                    {[...Array(6)].map((_, i) => (
                        <motion.div 
                            key={i}
                            animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.5, 0.2] }}
                            transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
                            className="absolute w-2 h-2 bg-luxury-accent rounded-full"
                            style={{ 
                                left: `${50 + 35 * Math.cos(i * (Math.PI / 3))}%`,
                                top: `${50 + 35 * Math.sin(i * (Math.PI / 3))}%`
                            }}
                        />
                    ))}
                 </div>
            </div>
        </div>
      </section>

      {/* Execution Flow Section (New) */}
      <section className="py-32 px-6 md:px-12 lg:px-24 border-b border-black/5">
        <div className="max-w-7xl mx-auto">
          <SectionHeader title="Execution Flow" subtitle="The Lifecycle" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { id: "01", title: "Architecture", desc: "Crafting the relational blueprint and normalization strategy.", icon: <Layers /> },
              { id: "02", title: "Engineering", desc: "Authoring clean, secure Laravel logic with SOLID principles.", icon: <Cpu /> },
              { id: "03", title: "Scale", desc: "Optimization, caching, and CI/CD for performance targets.", icon: <Sparkles /> }
            ].map((step, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.2 }}
                className="space-y-6 group"
              >
                <div className="text-5xl font-serif text-luxury-accent/20 group-hover:text-luxury-accent transition-colors font-bold">
                  {step.id}
                </div>
                <h4 className="text-2xl font-serif">{step.title}</h4>
                <p className="text-luxury-gray/60 font-light leading-relaxed">
                  {step.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section (New for SEO) */}
      <section className="py-32 px-6 md:px-12 lg:px-24 bg-white relative overflow-hidden">
        <div className="max-w-3xl mx-auto">
          <SectionHeader title="Common Queries" subtitle="Assurance" />
          <div className="space-y-4">
            {[
              { q: "Do you offer post-launch support?", a: "Yes, I provide comprehensive maintenance and scaling support for all custom backend systems I build." },
              { q: "What is your primary tech stack?", a: "I specialize in the PHP/Laravel ecosystem, MySQL orchestration, and RESTful API integration." },
              { q: "Are you available for full-time remote roles?", a: "Currently, I am prioritizing high-impact freelance commissions and strategic backend consultancies." }
            ].map((item, i) => (
              <motion.details 
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="group border border-black/5 bg-luxury-black/5 p-6 cursor-pointer"
              >
                <summary className="flex justify-between items-center font-serif text-lg md:text-xl list-none">
                  {item.q}
                  <span className="text-luxury-accent group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-4 text-luxury-gray/70 font-light leading-relaxed">
                  {item.a}
                </p>
              </motion.details>
            ))}
          </div>
        </div>
      </section>

      {/* Trajectory Section (Existing) */}
      <section id="about" className="py-32 px-6 md:px-12 lg:px-24">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-24">
          <div className="lg:col-span-1">
            <SectionHeader title="Trajectory" subtitle="Background" />
            <p className={`text-luxury-gray/70 leading-relaxed italic border-l-2 pl-6 border-luxury-accent py-4 mb-8`}>
              "Developing secure and scalable systems isn't just work; it's an architectural discipline."
            </p>
            
            <div className="space-y-4">
              <h4 className="text-xs uppercase tracking-[0.3em] font-bold text-luxury-accent mb-4">Credentials</h4>
              {[
                "English Language (B2) - Mansoura University",
                "Full-Stack Web Dev - Mansoura University",
                "Graphic Design - Mansoura University"
              ].map((cert, i) => (
                <div key={i} className="flex items-center gap-3 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4 text-luxury-accent" />
                  {cert}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-16">
            <div className="space-y-8">
              <div className="flex items-baseline justify-between border-b border-black/5 pb-4">
                <h3 className="text-2xl font-serif">Freelance Backend Architect</h3>
                <span className="text-xs font-mono text-luxury-gray/50 uppercase">2023 — Present</span>
              </div>
              <p className="text-luxury-gray font-light text-lg">
                Delivering high-performance Laravel backends for international clients. Focusing on scalability, security audits, and clean database normalization. Responsible for end-to-end API orchestration and custom dashboard ecosystems.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {["Secure API Design", "Database Normalization", "MVC Orchestration", "Auth Guard Systems"].map((feat) => (
                  <div key={feat} className="p-4 bg-luxury-black/5 text-xs uppercase tracking-widest font-bold">
                    {feat}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-baseline justify-between border-b border-black/5 pb-4">
                <h4 className="text-xl font-serif">Cultural Identity</h4>
                <div className="flex gap-4">
                  <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-luxury-accent">
                    Arabic: Native
                  </span>
                  <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-luxury-accent">
                    English: B2
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-luxury-gray/70">
                <MapPin className="w-4 h-4 text-luxury-accent" />
                <span className="text-sm">Mansoura, Egypt. Available Worldwide.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA / Contact */}
      <section id="contact" className="py-32 px-6 md:px-12 lg:px-24 bg-luxury-black overflow-hidden relative">
        <div className="max-w-7xl mx-auto relative z-10">
          <SectionHeader title="Let's Build Together" subtitle="Consultation" />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-24">
            <div className="space-y-12">
              <p className="text-white/60 text-xl leading-relaxed font-light">
                Currently open for freelance commissions and remote backend engineering roles. If you need clean, secure, and scalable high-performance code, let's connect.
              </p>
              
              <div className="space-y-6">
                <a href="mailto:ahmedeljeady@gmail.com" className="group flex items-center gap-6 text-2xl md:text-4xl text-white font-serif hover:text-luxury-accent transition-colors">
                  <Mail className="w-8 h-8 md:w-12 md:h-12" />
                  ahmedeljeady@gmail.com
                </a>
                <div className={`flex items-center gap-6 text-2xl md:text-3xl text-white/50 font-serif`}>
                  <Phone className="w-6 h-6 md:w-8 md:h-8" />
                  +20 106 035 7954
                </div>
              </div>
            </div>

            <ContactForm />
          </div>
        </div>

        {/* Decorative Grid */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-white/5 to-transparent pointer-events-none opacity-20" />
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 md:px-12 lg:px-24 flex flex-col md:flex-row justify-between items-center gap-8 border-t border-black/5 bg-white relative">
        <div className="flex gap-8">
          {["Github", "LinkedIn", "Mail"].map(item => (
            <a key={item} href="#" className="text-[10px] uppercase tracking-widest font-bold text-luxury-gray hover:text-luxury-accent transition-colors">
              {item}
            </a>
          ))}
        </div>
        
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[8px] uppercase tracking-widest font-bold text-luxury-gray/40">Engine Stage: Production</span>
           </div>
           <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-luxury-accent rounded-full animate-pulse" />
              <span className="text-[8px] uppercase tracking-widest font-bold text-luxury-gray/40">Heartbeat: Stable</span>
           </div>
        </div>

        <div className="text-[10px] uppercase font-mono text-luxury-gray/50">
          © 2026 Ahmed Mohamed El-Jaidi. Architecture of the Future.
        </div>
      </footer>
    </div>
  );
}
