
import React from 'react';
import { PERSONAS } from '../constants';
import { Persona } from '../types';

interface PersonaSelectorProps {
  selectedPersona: Persona;
  onSelect: (persona: Persona) => void;
  disabled: boolean;
}

// Map color keys to explicit Tailwind classes so the JIT compiler can find them
const PERSONA_THEMES: Record<string, { bg: string, border: string, text: string, shadow: string }> = {
  indigo: { 
    bg: 'bg-indigo-50 dark:bg-indigo-900/20', 
    border: 'border-indigo-500', 
    text: 'text-indigo-600 dark:text-indigo-400',
    shadow: 'shadow-indigo-200 dark:shadow-indigo-900/40'
  },
  emerald: { 
    bg: 'bg-emerald-50 dark:bg-emerald-900/20', 
    border: 'border-emerald-500', 
    text: 'text-emerald-600 dark:text-emerald-400',
    shadow: 'shadow-emerald-200 dark:shadow-emerald-900/40'
  },
  amber: { 
    bg: 'bg-amber-50 dark:bg-amber-900/20', 
    border: 'border-amber-500', 
    text: 'text-amber-600 dark:text-amber-400',
    shadow: 'shadow-amber-200 dark:shadow-amber-900/40'
  },
  rose: { 
    bg: 'bg-rose-50 dark:bg-rose-900/20', 
    border: 'border-rose-500', 
    text: 'text-rose-600 dark:text-rose-400',
    shadow: 'shadow-rose-200 dark:shadow-rose-900/40'
  }
};

export const PersonaSelector: React.FC<PersonaSelectorProps> = ({ selectedPersona, onSelect, disabled }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {PERSONAS.map((p) => {
        const isActive = selectedPersona.id === p.id;
        const theme = PERSONA_THEMES[p.color] || PERSONA_THEMES.indigo;
        
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            disabled={disabled}
            className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all duration-300 relative overflow-hidden ${
              isActive
                ? `${theme.bg} ${theme.border} shadow-lg scale-105 z-10`
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100 hover:border-slate-300'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer active:scale-95'}`}
          >
            {isActive && (
              <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-${p.color}-500 to-transparent opacity-50`} />
            )}
            <span className="text-3xl mb-1 drop-shadow-sm">{p.avatar}</span>
            <span className={`text-sm font-bold ${isActive ? theme.text : 'text-slate-700 dark:text-slate-300'}`}>
              {p.name}
            </span>
            <span className="text-[10px] uppercase tracking-tighter text-slate-400 dark:text-slate-500 font-bold">
              {p.role}
            </span>
          </button>
        );
      })}
    </div>
  );
};
