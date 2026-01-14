
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

  return (
    <div className={`flex w-full mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] rounded-2xl px-3 py-2 shadow relative group transition-all active:scale-[0.98] ${
        isUser 
          ? 'bg-[#2b5278] text-white rounded-br-none' 
          : 'bg-[#182533] text-gray-100 rounded-bl-none border border-[#2b394a]'
      }`}>
        {message.parts.map((part, idx) => (
          <div key={idx} className="space-y-2">
            {part.inlineData && (
              <img 
                src={`data:${part.inlineData.mimeType};base64,${part.inlineData.data}`} 
                alt="Media" 
                className="w-full rounded-xl mb-2 object-cover"
              />
            )}
            {part.text && (
              <div className="prose prose-invert prose-xs max-w-none break-words text-sm leading-snug">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {part.text}
                </ReactMarkdown>
              </div>
            )}
          </div>
        ))}

        {message.sources && message.sources.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/10 text-[10px]">
            <div className="flex flex-wrap gap-1">
              {message.sources.slice(0, 3).map((source, sIdx) => (
                <a key={sIdx} href={source.uri} target="_blank" className="bg-white/5 px-1.5 py-0.5 rounded text-blue-400">
                  📎 {source.title?.slice(0, 15)}...
                </a>
              ))}
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-end mt-1 gap-2">
          <button onClick={copyToClipboard} className="text-[10px] text-gray-500 opacity-50 group-hover:opacity-100">
            {copied ? 'скопировано' : 'копия'}
          </button>
          <div className={`text-[10px] ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
