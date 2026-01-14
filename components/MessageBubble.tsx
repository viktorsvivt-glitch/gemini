
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, Role } from '../types';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === Role.USER;
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    const text = message.parts.map(p => p.text).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const speakText = () => {
    const text = message.parts.map(p => p.text).join('\n');
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ru-RU';
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className={`flex w-full mb-6 animate-msg ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[90%] md:max-w-[75%] rounded-2xl p-4 shadow-lg relative group ${
        isUser 
          ? 'bg-[#2b5278] text-white rounded-br-none' 
          : 'bg-[#182533] text-gray-100 rounded-bl-none border border-[#2b394a]'
      }`}>
        {message.parts.map((part, idx) => (
          <div key={idx} className="space-y-3">
            {part.inlineData && (
              <img 
                src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} 
                alt="Media" 
                className="max-w-full rounded-xl mb-3 border border-white/10"
              />
            )}
            {part.text && (
              <div className="prose prose-invert prose-sm max-w-none break-words">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {part.text}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {/* Sources Section */}
        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 text-xs">
            <p className="text-gray-400 mb-2 font-medium">Источники:</p>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((source, sIdx) => (
                <a 
                  key={sIdx} 
                  href={source.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition-colors text-blue-400 truncate max-w-[200px]"
                >
                  {source.title || 'Ссылка'}
                </a>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between mt-2 gap-4">
          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={copyToClipboard}
              className="p-1 hover:bg-white/10 rounded text-gray-400"
              title="Копировать"
            >
              {copied ? '✅' : '📋'}
            </button>
            {!isUser && (
              <button 
                onClick={speakText}
                className="p-1 hover:bg-white/10 rounded text-gray-400"
                title="Озвучить"
              >
                🔊
              </button>
            )}
          </div>
          <div className={`text-[10px] flex items-center gap-1 ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
            <span>{new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            {isUser && (
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
