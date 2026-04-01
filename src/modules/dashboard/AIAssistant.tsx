import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, Send, Bot, User, Loader2, MessageSquare, Lightbulb, TrendingUp, AlertCircle } from 'lucide-react';
import { generateAIResponse } from '../../services/gemini';
import { cn } from '../../utils';
import { Button } from '../../components/ui/Button';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  context?: string;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ isOpen, onClose, context }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: `Olá! Sou seu assistente de IA. Como posso ajudar com a gestão da sua oficina hoje? Estou ciente de que você está na tela de: **${context || 'Geral'}**.`,
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await generateAIResponse(input, context);
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response || 'Desculpe, não consegui gerar uma resposta.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, context]);

  const suggestions = useMemo(() => [
    { icon: Lightbulb, text: "Dicas para aumentar vendas" },
    { icon: TrendingUp, text: "Análise de lucratividade" },
    { icon: AlertCircle, text: "Como lidar com clientes difíceis" },
    { icon: MessageSquare, text: "Modelo de mensagem para orçamento" }
  ], []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[100]"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white dark:bg-zinc-950 shadow-2xl z-[101] flex flex-col border-l border-border"
          >
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-zinc-100 dark:bg-zinc-900 rounded-xl flex items-center justify-center">
                  <Sparkles size={20} className="text-amber-500" />
                </div>
                <div>
                  <h3 className="font-bold font-display">Assistente de IA</h3>
                  <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-black">Inteligência Automotiva</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose} className="!p-2">
                <X size={20} />
              </Button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-3 max-w-[85%]",
                    msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                    msg.role === 'assistant' ? "bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white" : "bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400"
                  )}>
                    {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div className={cn(
                    "p-4 rounded-2xl text-sm leading-relaxed",
                    msg.role === 'assistant' 
                      ? "bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-border" 
                      : "bg-accent text-accent-foreground shadow-lg shadow-accent/20"
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white flex items-center justify-center shrink-0">
                    <Bot size={16} />
                  </div>
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 text-zinc-400 border border-border flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-xs italic">Pensando...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {messages.length === 1 && (
              <div className="px-6 pb-4 grid grid-cols-2 gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(s.text);
                      // Trigger send manually after state update
                      setTimeout(() => handleSend(), 0);
                    }}
                    className="flex items-center gap-2 p-3 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-border rounded-xl text-[10px] font-bold text-zinc-600 dark:text-zinc-400 transition-all text-left"
                  >
                    <s.icon size={14} className="text-zinc-400" />
                    {s.text}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSend} className="p-6 border-t border-border bg-white dark:bg-zinc-950">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Pergunte qualquer coisa..."
                  className="w-full pl-4 pr-12 py-4 bg-zinc-50 dark:bg-zinc-900 border border-border rounded-2xl focus:outline-none focus:ring-2 focus:ring-accent transition-all text-sm dark:text-white"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={isLoading}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-accent text-accent-foreground rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-[10px] text-zinc-400 text-center mt-4 uppercase tracking-widest font-bold">
                Powered by Gemini AI
              </p>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AIAssistant;
