import React from 'react';
import { LANGUAGES } from '../constants';
import { Language } from '../types';

interface LanguageSelectorProps {
  selectedLanguage: Language;
  onSelect: (lang: Language) => void;
  disabled: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ selectedLanguage, onSelect, disabled }) => {
  return (
    <div className="flex flex-wrap gap-2 justify-center mb-6">
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => onSelect(lang)}
          disabled={disabled}
          className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all duration-200 ${
            selectedLanguage.code === lang.code
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-md scale-105'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-indigo-300 dark:hover:border-indigo-700'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}`}
        >
          <span className="text-xl filter drop-shadow-sm">{lang.flag}</span>
          <span className="font-medium text-sm md:text-base">{lang.name}</span>
        </button>
      ))}
    </div>
  );
};