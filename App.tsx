
import React, { useState, useRef, useEffect } from 'react';
import { Message, Role, ChatSession } from './types';
import MessageBubble from './components/MessageBubble';
import { streamGeminiResponse } from './services/geminiService';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('gemini_sessions');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [imagePreview, setImagePreview] = useState<{data: string, type: string} | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('gemini_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (!currentSessionId && sessions.length > 0) {
      setCurrentSessionId(sessions[0].id);
    } else if (sessions.length === 0) {
      createNewChat();
    }
  }, [sessions, currentSessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [sessions, isTyping]);

  const currentSession = sessions.find(s => s.id === currentSessionId);

  const createNewChat = () => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: 'Новый диалог',
      messages: [{
        id: 'init-' + Date.now(),
        role: Role.MODEL,
        parts: [{ text: 'Привет! Я Gemini Pro. Я умею искать информацию в Google и анализировать изображения. Чем могу помочь?' }],
        timestamp: new Date(),
        status: 'sent'
      }]
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
  };

  const deleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== id));
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

    // Обновление названия чата, если это первое сообщение пользователя
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        const isFirstUserMsg = !s.messages.some(m => m.role === Role.USER);
        return {
          ...s,
          title: isFirstUserMsg ? (inputText.slice(0, 25) + (inputText.length > 25 ? '...' : '')) : s.title,
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
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { 
              ...s, 
              messages: s.messages.map(m => 
                m.id === modelMessageId ? { ...m, parts: [{ text: "⚠️ Ошибка связи с API." }], status: 'error' } : m
              ) 
            }
          : s
      ));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0e1621] overflow-hidden">
      {/* Sidebar Overlay for Mobile */}
      {!isSidebarOpen && (
        <button 
          onClick={() => setIsSidebarOpen(true)}
          className="md:hidden absolute top-4 left-4 z-50 p-2 bg-[#2b5278] rounded-full shadow-lg"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* Sidebar */}
      <div className={`${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 transition-transform fixed md:relative z-40 flex flex-col w-80 h-full bg-[#17212b] border-r border-[#0e1621]`}>
        <div className="p-4 flex justify-between items-center border-b border-[#0e1621]">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs shadow-lg shadow-blue-500/20">G</div>
            Gemini Pro
          </h1>
          <div className="flex gap-1">
             <button 
              onClick={createNewChat}
              className="p-2 hover:bg-[#2b394a] rounded-lg transition-colors text-blue-400"
              title="Новый чат"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-2 hover:bg-[#2b394a] rounded-lg text-gray-400"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => setCurrentSessionId(s.id)}
              className={`group w-full p-3 rounded-lg text-left cursor-pointer transition-all flex items-center gap-3 ${
                s.id === currentSessionId ? 'bg-[#2b5278]' : 'hover:bg-[#242f3d]'
              }`}
            >
              <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${s.id === currentSessionId ? 'bg-blue-400' : 'bg-[#3d4b5c]'}`}>
                {s.title.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 truncate">
                <div className="font-medium truncate text-sm">{s.title}</div>
                <div className="text-[11px] text-gray-400 truncate opacity-70">
                  {s.messages[s.messages.length-1]?.parts[0].text || "..."}
                </div>
              </div>
              <button 
                onClick={(e) => deleteSession(s.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col relative bg-[#0e1621]">
        <header className="h-14 bg-[#17212b]/80 backdrop-blur-md flex items-center px-4 md:px-8 border-b border-[#0e1621] shadow-sm z-30 sticky top-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-full flex items-center justify-center font-bold text-sm shadow-lg">
              G
            </div>
            <div>
              <div className="font-semibold text-sm">Gemini AI Assistant</div>
              <div className="text-[10px] text-blue-400 uppercase tracking-tighter font-bold flex items-center gap-1">
                {isTyping ? (
                  <>
                    <span className="w-1 h-1 bg-blue-400 rounded-full animate-ping"></span>
                    Думает...
                  </>
                ) : 'онлайн'}
              </div>
            </div>
          </div>
        </header>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:px-20 lg:px-40 custom-scrollbar scroll-smooth"
          style={{ backgroundImage: 'radial-gradient(#1c2a39 1px, transparent 1px)', backgroundSize: '30px 30px' }}
        >
          {currentSession?.messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isTyping && (
            <div className="flex justify-start mb-6">
              <div className="bg-[#182533] rounded-2xl rounded-bl-none p-4 border border-[#2b394a] shadow-md">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-blue-500/50 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></span>
                  <span className="w-2 h-2 bg-blue-500/50 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></span>
                  <span className="w-2 h-2 bg-blue-500/50 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></span>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="p-4 md:p-6 bg-[#17212b]/90 backdrop-blur-sm border-t border-[#0e1621] z-30">
          <div className="max-w-4xl mx-auto relative">
            {imagePreview && (
              <div className="absolute -top-24 left-0 flex items-center bg-[#17212b] p-2 rounded-xl border border-blue-500 animate-msg">
                <img 
                  src={`data:${imagePreview.type};base64,${imagePreview.data}`} 
                  alt="Preview" 
                  className="h-16 w-16 object-cover rounded-lg"
                />
                <button 
                  onClick={() => setImagePreview(null)}
                  className="ml-2 p-1 text-red-400 hover:bg-red-500/10 rounded-full"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
            
            <div className="flex items-end gap-3">
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
                      const base64 = (reader.result as string).split(',')[1];
                      setImagePreview({ data: base64, type: file.type });
                    };
                    reader.readAsDataURL(file);
                  }
                }}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-3 text-gray-400 hover:text-blue-400 transition-colors bg-[#242f3d] rounded-xl"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>

              <div className="flex-1 bg-[#242f3d] rounded-2xl overflow-hidden border border-transparent focus-within:border-blue-500/50 transition-all">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  placeholder="Задайте любой вопрос..."
                  className="w-full bg-transparent p-4 text-sm focus:outline-none resize-none max-h-40 min-h-[56px] custom-scrollbar"
                  rows={1}
                />
              </div>

              <button 
                onClick={handleSendMessage}
                disabled={(!inputText.trim() && !imagePreview) || isTyping}
                className={`p-4 rounded-2xl transition-all shadow-xl ${
                  (!inputText.trim() && !imagePreview) || isTyping
                    ? 'bg-gray-700 text-gray-500 scale-95'
                    : 'bg-blue-600 text-white hover:bg-blue-500 hover:-translate-y-0.5 active:translate-y-0'
                }`}
              >
                <svg className="w-6 h-6 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                </svg>
              </button>
            </div>
            <div className="mt-3 flex justify-center items-center gap-4 text-[9px] text-gray-500 uppercase tracking-widest font-bold">
              <span>Grounding: Google Search</span>
              <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
              <span>Model: Gemini 3 Pro</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
