import React, { useState, useEffect, useRef } from 'react';
import { Search, User, ClipboardList, Car, X, Loader2 } from 'lucide-react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { cn } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

interface SearchResult {
  id: string;
  type: 'client' | 'os' | 'vehicle';
  title: string;
  subtitle: string;
  data: any;
}

interface GlobalSearchProps {
  onSelect: (type: string, id: string) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({ onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 2) {
        setLoading(true);
        try {
          const empresaId = localStorage.getItem('empresaId');
          if (!empresaId) return;

          const searchResults: SearchResult[] = [];

          // Search Clients
          const clientsRef = collection(db, 'clientes');
          const clientQuery = query(
            clientsRef,
            where('empresaId', '==', empresaId),
            limit(5)
          );
          const clientSnap = await getDocs(clientQuery);
          clientSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.name.toLowerCase().includes(searchTerm.toLowerCase()) || data.phone.includes(searchTerm)) {
              searchResults.push({
                id: doc.id,
                type: 'client',
                title: data.name,
                subtitle: `Cliente • ${data.phone}`,
                data
              });
            }
          });

          // Search Vehicles (Plates)
          const vehiclesRef = collection(db, 'veiculos');
          const vehicleQuery = query(
            vehiclesRef,
            where('empresaId', '==', empresaId),
            limit(5)
          );
          const vehicleSnap = await getDocs(vehicleQuery);
          vehicleSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.plate.toLowerCase().includes(searchTerm.toLowerCase()) || data.model.toLowerCase().includes(searchTerm.toLowerCase())) {
              searchResults.push({
                id: doc.id,
                type: 'vehicle',
                title: `${data.brand} ${data.model}`,
                subtitle: `Veículo • Placa: ${data.plate}`,
                data
              });
            }
          });

          // Search OS
          const osRef = collection(db, 'ordens_servico');
          const osQuery = query(
            osRef,
            where('empresaId', '==', empresaId),
            limit(5)
          );
          const osSnap = await getDocs(osQuery);
          osSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.numeroOS.toString().includes(searchTerm)) {
              searchResults.push({
                id: doc.id,
                type: 'os',
                title: `OS #${data.numeroOS}`,
                subtitle: `Ordem de Serviço • ${data.status}`,
                data
              });
            }
          });

          setResults(searchResults);
        } catch (error) {
          console.error('Search error:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setResults([]);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  return (
    <div className="relative w-full max-w-xl" ref={searchRef}>
      <div className={cn(
        "flex items-center gap-3 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 rounded-2xl border border-border group focus-within:ring-4 focus-within:ring-accent/5 focus-within:border-accent/30 transition-all duration-300",
        isOpen && results.length > 0 && "rounded-b-none border-b-transparent"
      )}>
        <Search size={18} className="text-slate-400 group-focus-within:text-accent transition-colors" />
        <input 
          type="text" 
          placeholder="Pesquisa global (clientes, OS, placas...)" 
          className="bg-transparent border-none outline-none text-sm font-medium w-full text-slate-800 dark:text-white placeholder:text-slate-400"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
        />
        {loading && <Loader2 size={16} className="text-accent animate-spin" />}
        {searchTerm && (
          <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 right-0 bg-white dark:bg-slate-800 border border-border border-t-0 rounded-b-[1.5rem] shadow-2xl z-[100] overflow-hidden"
          >
            <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
              {results.map((result) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => {
                    onSelect(result.type, result.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-left group border-b border-border last:border-none"
                >
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110",
                    result.type === 'client' ? "bg-blue-50 text-blue-500 dark:bg-blue-500/10" :
                    result.type === 'os' ? "bg-amber-50 text-amber-500 dark:bg-amber-500/10" :
                    "bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10"
                  )}>
                    {result.type === 'client' ? <User size={20} /> :
                     result.type === 'os' ? <ClipboardList size={20} /> :
                     <Car size={20} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800 dark:text-white truncate group-hover:text-accent transition-colors font-display">{result.title}</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">{result.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

