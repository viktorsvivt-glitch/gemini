
import React, { useState, useRef, useEffect } from 'react';
import { Message, Role, ChatSession } from './types';
import MessageBubble from './components/MessageBubble';
import { streamGeminiResponse } from './services/geminiService';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('gemini_sessions_mobile');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [imagePreview, setImagePreview] = useState<{data: string, type: string} | null>(null);
  const [view, setView] = useState<'LIST' | 'CHAT'>('LIST');
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('gemini_sessions_mobile', JSON.stringify(sessions));
  }, [sessions]);

  // При первом запуске создаем чат, если их нет
  useEffect(() => {
    if (sessions.length === 0) {
      createNewChat();
    }
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [sessions, isTyping, view]);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'Новый чат',
      messages: [{
        id: 'init-' + Date.now(),
        role: Role.MODEL,
        parts: [{ text: 'Привет! Я Gemini. Чем могу помочь сегодня?' }],
        timestamp: new Date(),
        status: 'sent'
      }]
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setView('CHAT');
  };

  const openChat = (id: string) => {
    setCurrentSessionId(id);
    setView('CHAT');
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) setCurrentSessionId(null);
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !imagePreview) || !currentSessionId) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      parts: [
        ...(imagePreview ? [{ inlineData: { mimeType: imagePreview.type, data: imagePreview.data } }] : []),
        ...(inputText.trim() ? [{ text: inputText.trim() }] : [])
      ],
      timestamp: new Date(),
      status: 'sent'
    };

    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        const isFirstUserMsg = !s.messages.some(m => m.role === Role.USER);
        return {
          ...s,
          title: isFirstUserMsg ? (inputText.slice(0, 20) + (inputText.length > 20 ? '...' : '')) : s.title,
          messages: [...s.messages, userMessage]
        };
      }
      return s;
    }));

    setInputText('');
    setImagePreview(null);
    setIsTyping(true);

    const modelMessageId = (Date.now() + 1).toString();
    const modelPlaceholder: Message = {
      id: modelMessageId,
      role: Role.MODEL,
      parts: [{ text: '' }],
      timestamp: new Date(),
      status: 'sending'
    };

    setSessions(prev => prev.map(s => 
      s.id === currentSessionId ? { ...s, messages: [...s.messages, modelPlaceholder] } : s
    ));

    try {
      const history = currentSession?.messages || [];
      await streamGeminiResponse(history, userMessage, (fullText, sources) => {
        setSessions(prev => prev.map(s => 
          s.id === currentSessionId 
            ? { 
                ...s, 
                messages: s.messages.map(m => 
                  m.id === modelMessageId ? { ...m, parts: [{ text: fullText }], sources, status: 'sent' } : m
                ) 
              }
            : s
        ));
      });
    } catch (error) {
      console.error(error);
      setIsTyping(false);
    } finally {
      setIsTyping(false);
    }
  };

  // Экран списка чатов
  if (view === 'LIST') {
    return (
      <div className="h-full flex flex-col bg-[#0e1621] safe-top screen-enter">
        <header className="h-16 flex items-center justify-between px-4 border-b border-[#1c2a39] bg-[#17212b]">
          <h1 className="text-xl font-bold">Чаты</h1>
          <button onClick={createNewChat} className="p-2 text-blue-400">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => openChat(s.id)}
              className="w-full p-4 rounded-2xl flex items-center gap-4 bg-[#17212b] active:bg-[#2b5278] transition-all mb-1 shadow-sm"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center font-bold text-lg">
                {s.title.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                  <span className="font-semibold truncate">{s.title}</span>
                  <span className="text-[10px] text-gray-500">
                    {s.messages.length > 0 && new Date(s.messages[s.messages.length-1].timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </span>
                </div>
                <p className="text-sm text-gray-400 truncate">
                  {s.messages[s.messages.length-1]?.parts[0].text || "Без текста"}
                </p>
              </div>
              <button onClick={(e) => deleteSession(s.id, e)} className="p-2 text-gray-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
        <footer className="h-16 border-t border-[#1c2a39] bg-[#17212b] flex items-center justify-around text-gray-400 safe-bottom">
           <button className="flex flex-col items-center text-blue-400">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" /></svg>
              <span className="text-[10px] font-bold">Чаты</span>
           </button>
           <button onClick={createNewChat} className="flex flex-col items-center">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              <span className="text-[10px]">Новый</span>
           </button>
        </footer>
      </div>
    );
  }

  // Экран активного чата
  return (
    <div className="h-full flex flex-col bg-[#0e1621] screen-enter overflow-hidden">
      <header className="h-16 flex items-center gap-3 px-2 border-b border-[#1c2a39] bg-[#17212b]/95 backdrop-blur safe-top sticky top-0 z-50">
        <button onClick={() => setView('LIST')} className="p-2 text-blue-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold flex-shrink-0">
            {currentSession?.title.charAt(0).toUpperCase() || 'G'}
          </div>
          <div className="truncate">
            <h2 className="font-semibold text-sm truncate">{currentSession?.title}</h2>
            <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">
              {isTyping ? 'печатает...' : 'онлайн'}
            </p>
          </div>
        </div>
      </header>

      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 custom-scrollbar"
        style={{ backgroundImage: 'radial-gradient(#1c2a39 0.5px, transparent 0.5px)', backgroundSize: '20px 20px' }}
      >
        {currentSession?.messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isTyping && (
          <div className="flex justify-start mb-4">
            <div className="bg-[#182533] rounded-2xl p-3 shadow-md border border-[#2b394a]">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <footer className="p-2 bg-[#17212b] border-t border-[#0e1621] safe-bottom">
        <div className="flex items-end gap-2 max-w-full">
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-blue-400 active:scale-90 transition-transform"
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setImagePreview({ data: (reader.result as string).split(',')[1], type: file.type });
                  };
                  reader.readAsDataURL(file);
                }
              }}
            />
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>

          <div className="flex-1 bg-[#242f3d] rounded-2xl flex flex-col p-1 border border-white/5 shadow-inner">
            {imagePreview && (
              <div className="p-2 relative inline-block">
                <img src={`data:${imagePreview.type};base64,${imagePreview.data}`} className="h-14 w-14 object-cover rounded-lg" />
                <button onClick={() => setImagePreview(null)} className="absolute top-0 right-0 bg-red-500 rounded-full p-1"><svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" /></svg></button>
              </div>
            )}
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Сообщение"
              className="w-full bg-transparent px-3 py-2 text-sm focus:outline-none resize-none max-h-32 min-h-[40px]"
              rows={1}
            />
          </div>

          <button 
            onClick={handleSendMessage}
            disabled={(!inputText.trim() && !imagePreview) || isTyping}
            className={`p-3 rounded-full shadow-lg ${
              (!inputText.trim() && !imagePreview) || isTyping ? 'text-gray-600' : 'text-blue-500'
            }`}
          >
            <svg className="w-7 h-7 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default App;
