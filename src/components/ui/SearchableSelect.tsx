import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ChevronDown } from 'lucide-react';
import { cn } from '../../utils';

interface Option {
  id: string;
  label: string;
  subLabel?: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  className?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = "Selecione...",
  label,
  required,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.id === value);

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    opt.subLabel?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={cn("space-y-2 relative", className)} ref={containerRef}>
      {label && (
        <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest ml-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "input-modern flex items-center justify-between cursor-pointer group",
          isOpen && "ring-2 ring-accent border-accent"
        )}
      >
        <span className={cn("truncate", !selectedOption && "text-zinc-400")}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={18} className={cn("text-zinc-400 transition-transform", isOpen && "rotate-180")} />
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-zinc-100 rounded-[1.5rem] shadow-2xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-4 border-b border-zinc-50">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                type="text"
                className="w-full bg-white border border-border rounded-xl pl-10 pr-4 py-2 text-sm font-medium focus:ring-2 focus:ring-accent transition-all placeholder:text-zinc-500"
                placeholder="Pesquisar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(option.id);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                  className={cn(
                    "px-6 py-4 hover:bg-zinc-50 cursor-pointer transition-colors flex flex-col",
                    value === option.id && "bg-accent/5 border-l-4 border-accent"
                  )}
                >
                  <span className="text-sm font-bold text-zinc-900">{option.label}</span>
                  {option.subLabel && (
                    <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mt-0.5">
                      {option.subLabel}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-zinc-400 italic text-sm">
                Nenhum resultado encontrado
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
