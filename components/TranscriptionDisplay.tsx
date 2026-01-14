import React, { useEffect, useRef } from 'react';
import { Message } from '../types';

interface TranscriptionDisplayProps {
  messages: Message[];
  currentInput: string;
  currentOutput: string;
}

export const TranscriptionDisplay: React.FC<TranscriptionDisplayProps> = ({ messages, currentInput, currentOutput }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentInput, currentOutput]);

  return (
    <div 
      ref={scrollRef}
      className="flex-1 w-full max-w-2xl mx-auto overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner p-6 space-y-4 mb-4 min-h-[300px] rounded-3xl transition-colors duration-300"
    >
      {messages.length === 0 && !currentInput && !currentOutput && (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 text-center px-8">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300">Ready to speak?</p>
          <p className="text-sm">Pick a language and hit "Start Practice". Your AI tutor is waiting.</p>
        </div>
      )}
      
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
          <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
            msg.role === 'user' 
              ? 'bg-indigo-600 text-white rounded-tr-none' 
              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700'
          }`}>
            <p className="text-[10px] font-bold mb-1 uppercase tracking-wider opacity-60">
              {msg.role === 'user' ? 'You' : 'WordWise AI'}
            </p>
            <p className="leading-relaxed text-sm md:text-base">{msg.text}</p>
          </div>
        </div>
      ))}

      {currentInput && (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-indigo-500/80 text-white rounded-tr-none italic border border-indigo-400/30">
            <p className="text-[10px] font-bold mb-1 uppercase tracking-wider opacity-60">Listening...</p>
            <p className="leading-relaxed text-sm md:text-base">{currentInput}</p>
          </div>
        </div>
      )}

      {currentOutput && (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700 animate-pulse">
            <p className="text-[10px] font-bold mb-1 uppercase tracking-wider opacity-60">AI Speaking...</p>
            <p className="leading-relaxed text-sm md:text-base">{currentOutput}</p>
          </div>
        </div>
      )}
    </div>
  );
};