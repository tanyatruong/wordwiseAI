
import React from 'react';
import { PERSONAS } from '../constants';
import { Persona } from '../types';

interface PersonaSelectorProps {
  selectedPersona: Persona;
  onSelect: (persona: Persona) => void;
  disabled: boolean;
}

export const PersonaSelector: React.FC<PersonaSelectorProps> = ({ selectedPersona, onSelect, disabled }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
      {PERSONAS.map((p) => {
        const isActive = selectedPersona.id === p.id;
        return (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            disabled={disabled}
            className={`flex flex-col items-center p-3 rounded-2xl border-2 transition-all duration-300 ${
              isActive
                ? `bg-${p.color}-50 dark:bg-${p.color}-900/20 border-${p.color}-500 shadow-lg scale-105 z-10`
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-60 hover:opacity-100'
            } ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className="text-3xl mb-1">{p.avatar}</span>
            <span className={`text-sm font-bold ${isActive ? `text-${p.color}-600 dark:text-${p.color}-400` : 'text-slate-700 dark:text-slate-300'}`}>
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
