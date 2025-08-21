import React, { useState, useEffect, useRef } from 'react';
import { usePluginAPI } from '@circuitexp1/plugin-kit';
import { OpenAIService } from '../services/openai-service';
import { ChatMessage } from '../services/openai-service';

interface ChatPanelProps {
  className?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ className }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  
  const api = usePluginAPI();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Get OpenAI service from plugin context
  const openaiService = api?.getService<OpenAIService>('openai');

  useEffect(() => {
    if (openaiService) {
      setMessages(openaiService.getMessageHistory());
    }
  }, [openaiService]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !openaiService || isLoading) return;

    setIsLoading(true);
    setError(null);
    setIsTyping(true);

    try {
      const response = await openaiService.sendChatMessage(input.trim());
      setMessages(openaiService.getMessageHistory());
      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    if (openaiService) {
      openaiService.clearMessageHistory();
      setMessages([]);
    }
  };

  const handleSaveConversation = async () => {
    if (!openaiService) return;

    const name = prompt('Enter conversation name:');
    if (name) {
      try {
        await openaiService.saveConversation(name);
        api?.ui.showNotification({
          title: 'Conversation Saved',
          message: `Saved as "${name}"`,
          type: 'success'
        });
      } catch (err) {
        api?.ui.showNotification({
          title: 'Save Failed',
          message: err instanceof Error ? err.message : 'Failed to save conversation',
          type: 'error'
        });
      }
    }
  };

  const formatMessageTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';
    
    return (
      <div
        key={message.timestamp}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}
      >
        <div
          className={`max-w-[80%] rounded-lg px-3 py-2 ${
            isUser
              ? 'bg-blue-500 text-white'
              : isSystem
              ? 'bg-gray-200 text-gray-700'
              : 'bg-gray-100 text-gray-900'
          }`}
        >
          <div className="text-sm mb-1">
            <span className="font-medium capitalize">{message.role}</span>
            <span className="ml-2 text-xs opacity-75">
              {formatMessageTime(message.timestamp)}
            </span>
            {message.tokens && (
              <span className="ml-2 text-xs opacity-75">
                {message.tokens} tokens
              </span>
            )}
          </div>
          <div className="text-sm whitespace-pre-wrap">
            {message.content}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-white ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">OpenAI Chat</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSaveConversation}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="Save Conversation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          </button>
          <button
            onClick={handleClearChat}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="Clear Chat"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-gray-400 mb-2">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">Start a conversation with OpenAI</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map(renderMessage)}
            {isTyping && (
              <div className="flex justify-start mb-3">
                <div className="bg-gray-100 rounded-lg px-3 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex space-x-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 resize-none border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            disabled={isLoading}
          />
          <button
            onClick={handleSendMessage}
            disabled={!input.trim() || isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {isLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              'Send'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};