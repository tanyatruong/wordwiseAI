
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Language, Message, ConnectionStatus, Persona } from './types';
import { LANGUAGES, GEMINI_MODEL, PERSONAS } from './constants';
import { LanguageSelector } from './components/LanguageSelector';
import { PersonaSelector } from './components/PersonaSelector';
import { TranscriptionDisplay } from './components/TranscriptionDisplay';
import { createBlob, decode, decodeAudioData } from './services/audioUtils';

const STORAGE_KEY = 'wordwise_live_messages';
const THEME_KEY = 'wordwise_theme';

const BUTTON_THEMES: Record<string, { bg: string, ring: string, text: string }> = {
  indigo: { bg: 'bg-indigo-600 hover:bg-indigo-700', ring: 'ring-indigo-100 dark:ring-indigo-900/40', text: 'text-indigo-600 dark:text-indigo-400' },
  emerald: { bg: 'bg-emerald-600 hover:bg-emerald-700', ring: 'ring-emerald-100 dark:ring-emerald-900/40', text: 'text-emerald-600 dark:text-emerald-400' },
  amber: { bg: 'bg-amber-600 hover:bg-amber-700', ring: 'ring-amber-100 dark:ring-amber-900/40', text: 'text-amber-600 dark:text-amber-400' },
  rose: { bg: 'bg-rose-600 hover:bg-rose-700', ring: 'ring-rose-100 dark:ring-rose-900/40', text: 'text-rose-600 dark:text-rose-400' },
};

const App: React.FC = () => {
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(LANGUAGES[0]);
  const [selectedPersona, setSelectedPersona] = useState<Persona>(PERSONAS[0]);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.IDLE);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });

  const [currentInputText, setCurrentInputText] = useState('');
  const [currentOutputText, setCurrentOutputText] = useState('');
  
  const accInputRef = useRef('');
  const accOutputRef = useRef('');
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const nextStartTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const stopAllAudio = useCallback(() => {
    audioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
  }, []);

  const translateToVietnamese = async (text: string): Promise<string> => {
    if (!text.trim()) return '';
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate the following text to Vietnamese. Provide ONLY the translated text, no extra commentary. Text: "${text}"`,
      });
      return response.text?.trim() || '';
    } catch (err) {
      console.error('Translation error:', err);
      return '';
    }
  };

  const handleStop = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close();
      outputAudioContextRef.current = null;
    }
    stopAllAudio();
    setStatus(ConnectionStatus.IDLE);
    accInputRef.current = '';
    accOutputRef.current = '';
    setCurrentInputText('');
    setCurrentOutputText('');
  }, [stopAllAudio]);

  const clearSession = () => {
    if (window.confirm('Are you sure you want to clear this conversation and start a new one?')) {
      setMessages([]);
      localStorage.removeItem(STORAGE_KEY);
      handleStop();
    }
  };

  const handleStart = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const dynamicInstruction = `
        ${selectedPersona.personality}
        CRITICAL LANGUAGE RULE: ${selectedLanguage.instruction}
        You must ONLY speak in ${selectedLanguage.name}. If the user speaks a different language, gently guide them back to ${selectedLanguage.name} while staying in character as ${selectedPersona.name}.
      `;

      const sessionPromise = ai.live.connect({
        model: GEMINI_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: dynamicInstruction,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            setStatus(ConnectionStatus.CONNECTED);
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                if (session) session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              const outCtx = outputAudioContextRef.current;
              if (outCtx) {
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
                const source = outCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outCtx.destination);
                source.onended = () => audioSourcesRef.current.delete(source);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                audioSourcesRef.current.add(source);
              }
            }

            if (message.serverContent?.inputTranscription) {
              accInputRef.current += message.serverContent.inputTranscription.text;
              setCurrentInputText(accInputRef.current);
            }
            if (message.serverContent?.outputTranscription) {
              accOutputRef.current += message.serverContent.outputTranscription.text;
              setCurrentOutputText(accOutputRef.current);
            }

            if (message.serverContent?.turnComplete) {
              const userText = accInputRef.current.trim();
              const modelText = accOutputRef.current.trim();
              
              if (userText || modelText) {
                const needsTranslation = selectedLanguage.code !== 'vi-VN';
                
                // Get translations concurrently if needed
                const [userTrans, modelTrans] = await Promise.all([
                  needsTranslation ? translateToVietnamese(userText) : Promise.resolve(''),
                  needsTranslation ? translateToVietnamese(modelText) : Promise.resolve('')
                ]);

                setMessages(prev => [
                  ...prev,
                  ...(userText ? [{ 
                    id: `u-${Date.now()}-${Math.random()}`, 
                    role: 'user', 
                    text: userText, 
                    translation: userTrans,
                    timestamp: Date.now() 
                  } as Message] : []),
                  ...(modelText ? [{ 
                    id: `m-${Date.now()}-${Math.random()}`, 
                    role: 'model', 
                    text: modelText, 
                    translation: modelTrans,
                    timestamp: Date.now() 
                  } as Message] : [])
                ]);
              }
              accInputRef.current = '';
              accOutputRef.current = '';
              setCurrentInputText('');
              setCurrentOutputText('');
            }

            if (message.serverContent?.interrupted) {
              stopAllAudio();
            }
          },
          onerror: (e) => {
            console.error('Session Error:', e);
            setStatus(ConnectionStatus.ERROR);
            handleStop();
          },
          onclose: () => handleStop()
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error('Start Error:', err);
      setStatus(ConnectionStatus.ERROR);
      handleStop();
    }
  };

  useEffect(() => {
    return () => handleStop();
  }, [handleStop]);

  const activeTheme = BUTTON_THEMES[selectedPersona.color] || BUTTON_THEMES.indigo;

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-hidden">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-3 px-6 shrink-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg">
              W
            </div>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
              WordWise AI
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleTheme} 
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
              title="Toggle theme"
            >
              {isDarkMode ? <SunIcon /> : <MoonIcon />}
            </button>
            
            {messages.length > 0 && (
              <button 
                onClick={clearSession} 
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full border border-red-200 dark:border-red-900/30 transition-all active:scale-95"
                title="Clear conversation and start over"
              >
                <TrashIcon />
                <span className="hidden sm:inline">Start New</span>
              </button>
            )}

            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold text-slate-500 border border-slate-200 dark:border-slate-700">
              <span className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
              {status}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:px-8 flex flex-col min-h-0">
        <div className="shrink-0">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-0.5">Your AI Language Partner</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs italic">Immersive practice anywhere, anytime</p>
          </div>

          <PersonaSelector selectedPersona={selectedPersona} onSelect={setSelectedPersona} disabled={status !== ConnectionStatus.IDLE} />
          <LanguageSelector selectedLanguage={selectedLanguage} onSelect={setSelectedLanguage} disabled={status !== ConnectionStatus.IDLE} />
        </div>

        <div className="shrink-0 flex justify-center pb-4 pt-2">
          {status === ConnectionStatus.CONNECTED ? (
            <button onClick={handleStop} className="group flex items-center gap-3 px-6 py-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-all hover:scale-105 active:scale-95 ring-4 ring-red-100 dark:ring-red-900/40">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-xs font-black tracking-widest uppercase">End Practice</span>
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={status === ConnectionStatus.CONNECTING}
              className={`group flex items-center gap-3 px-8 py-3 ${activeTheme.bg} text-white rounded-full shadow-lg transition-all hover:scale-105 active:scale-95 ring-4 ${activeTheme.ring} ${status === ConnectionStatus.CONNECTING ? 'opacity-70 cursor-wait' : 'cursor-pointer'}`}
            >
              {status === ConnectionStatus.CONNECTING ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span className="text-xl">{selectedPersona.avatar}</span>
              )}
              <span className="text-xs font-black tracking-widest uppercase">
                {status === ConnectionStatus.CONNECTING ? 'Connecting...' : `Start Chatting with ${selectedPersona.name}`}
              </span>
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 flex flex-col pb-4">
          <TranscriptionDisplay messages={messages} currentInput={currentInputText} currentOutput={currentOutputText} />
        </div>
      </main>
    </div>
  );
};

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
  </svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
  </svg>
);

const TrashIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export default App;
