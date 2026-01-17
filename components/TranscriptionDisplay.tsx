
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
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, currentInput, currentOutput]);

  return (
    <div 
      ref={scrollRef}
      className="flex-1 w-full max-w-2xl mx-auto overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner p-4 md:p-6 space-y-4 rounded-3xl transition-colors duration-300 relative scroll-smooth"
    >
      {messages.length === 0 && !currentInput && !currentOutput && (
        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 text-center px-8">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4 border border-slate-100 dark:border-slate-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-300">Ready to chat?</p>
          <p className="text-sm">Select a friend and a language, then start practice!</p>
        </div>
      )}
      
      <div className="space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
              msg.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-none' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700'
            }`}>
              <p className="text-[10px] font-black mb-1 uppercase tracking-widest opacity-60">
                {msg.role === 'user' ? 'YOU' : 'COMPANION'}
              </p>
              <p className="leading-relaxed text-sm md:text-base">{msg.text}</p>
              
              {msg.translation && (
                <div className={`mt-2 pt-2 border-t text-xs italic opacity-90 ${
                  msg.role === 'user' ? 'border-white/20 text-indigo-50' : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400'
                }`}>
                  {msg.translation}
                </div>
              )}
            </div>
          </div>
        ))}

        {currentInput && (
          <div className="flex justify-end animate-in fade-in slide-in-from-bottom-1 duration-200">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-indigo-500/80 text-white rounded-tr-none italic border border-indigo-400/30">
              <p className="text-[10px] font-black mb-1 uppercase tracking-widest opacity-60">HEARING...</p>
              <p className="leading-relaxed text-sm md:text-base">{currentInput}</p>
            </div>
          </div>
        )}

        {currentOutput && (
          <div className="flex justify-start animate-in fade-in slide-in-from-bottom-1 duration-200">
            <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200 dark:border-slate-700 animate-pulse">
              <p className="text-[10px] font-black mb-1 uppercase tracking-widest opacity-60">SPEAKING...</p>
              <p className="leading-relaxed text-sm md:text-base">{currentOutput}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
