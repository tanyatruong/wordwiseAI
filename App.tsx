
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
    if (window.confirm('Clear conversation history?')) {
      setMessages([]);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handleStart = async () => {
    try {
      setStatus(ConnectionStatus.CONNECTING);
      accInputRef.current = '';
      accOutputRef.current = '';

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Dynamic System Instruction: Combine Persona Personality + Language constraints
      const dynamicInstruction = `
        ${selectedPersona.personality}
        
        CRITICAL LANGUAGE RULE:
        ${selectedLanguage.instruction}
        
        You must ONLY speak in the language specified above. If the user speaks a different language, gently guide them back to ${selectedLanguage.name} while maintaining your character as ${selectedPersona.name}.
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
              const text = message.serverContent.inputTranscription.text;
              accInputRef.current += text;
              setCurrentInputText(accInputRef.current);
            }
            if (message.serverContent?.outputTranscription) {
              const text = message.serverContent.outputTranscription.text;
              accOutputRef.current += text;
              setCurrentOutputText(accOutputRef.current);
            }

            if (message.serverContent?.turnComplete) {
              const userText = accInputRef.current.trim();
              const modelText = accOutputRef.current.trim();
              if (userText || modelText) {
                setMessages(prev => {
                  const newMsgs = [...prev];
                  if (userText) newMsgs.push({ id: `u-${Date.now()}-${Math.random()}`, role: 'user', text: userText, timestamp: Date.now() });
                  if (modelText) newMsgs.push({ id: `m-${Date.now()}-${Math.random()}`, role: 'model', text: modelText, timestamp: Date.now() });
                  return newMsgs;
                });
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-900 dark:text-slate-100 transition-colors duration-300">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4 px-6 sticky top-0 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-indigo-100 dark:ring-indigo-900">
              W
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400">
              WordWise AI
            </h1>
          </div>
          
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
              {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>
            {messages.length > 0 && (
              <button onClick={clearSession} className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition-colors px-3 py-1.5 border border-slate-200 dark:border-slate-800 rounded-full">
                RESET
              </button>
            )}
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold text-slate-500 border border-slate-200 dark:border-slate-700">
              <span className={`w-2 h-2 rounded-full ${status === ConnectionStatus.CONNECTED ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
              {status}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 flex flex-col items-center overflow-hidden">
        <div className="text-center mb-6 shrink-0">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1">Talk to Your AI Companion</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm italic">Choose who you want to meet today</p>
        </div>

        <div className="w-full shrink-0">
          <PersonaSelector 
            selectedPersona={selectedPersona} 
            onSelect={setSelectedPersona} 
            disabled={status !== ConnectionStatus.IDLE} 
          />
          <LanguageSelector 
            selectedLanguage={selectedLanguage} 
            onSelect={setSelectedLanguage} 
            disabled={status !== ConnectionStatus.IDLE}
          />
        </div>

        <div className="flex-1 w-full flex flex-col min-h-0 relative">
          <TranscriptionDisplay 
            messages={messages} 
            currentInput={currentInputText} 
            currentOutput={currentOutputText} 
          />
        </div>

        <div className="w-full flex justify-center py-6 bg-transparent shrink-0">
          {status === ConnectionStatus.CONNECTED ? (
            <button onClick={handleStop} className="group flex flex-col items-center gap-2">
              <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-red-600 transition-all hover:scale-105 ring-4 ring-red-100 dark:ring-red-900/40">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <span className="text-[10px] font-black text-red-500 tracking-widest uppercase">End Chat</span>
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={status === ConnectionStatus.CONNECTING}
              className={`flex flex-col items-center gap-2 group ${status === ConnectionStatus.CONNECTING ? 'opacity-70 cursor-wait' : 'cursor-pointer'}`}
            >
              <div className={`w-20 h-20 bg-${selectedPersona.color}-600 rounded-full flex items-center justify-center text-white shadow-xl hover:scale-105 transition-all ring-4 ring-${selectedPersona.color}-100 dark:ring-${selectedPersona.color}-900/40`}>
                {status === ConnectionStatus.CONNECTING ? (
                  <svg className="animate-spin h-10 w-10 text-white" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  <span className="text-4xl">{selectedPersona.avatar}</span>
                )}
              </div>
              <span className={`text-[10px] font-black text-${selectedPersona.color}-600 dark:text-${selectedPersona.color}-400 tracking-widest uppercase`}>
                {status === ConnectionStatus.CONNECTING ? 'Initializing...' : `Talk to ${selectedPersona.name}`}
              </span>
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
