import React from "react";
import { Bell, BookOpen, Bot, ChevronDown, FileText, Moon, Paperclip, Send, Sparkles, Sun, UserCircle } from "lucide-react";

interface AIAssistantProps {
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}

const AIAssistant: React.FC<AIAssistantProps> = ({ theme = "light", onToggleTheme = () => {} }) => {
  return (
    <div className="flex flex-col w-full h-full bg-white relative">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button className="flex items-center px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50">
              Select Course <ChevronDown className="ml-2 w-4 h-4" />
            </button>
            <span className="text-gray-300">/</span>
            <button className="flex items-center px-4 py-2 bg-white rounded-xl shadow-sm border border-gray-200 text-gray-700 font-medium text-sm hover:bg-gray-50">
              Select Materials <ChevronDown className="ml-2 w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 rounded-full hover:bg-gray-100" onClick={onToggleTheme} aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="w-5 h-5 text-gray-500" /> : <Moon className="w-5 h-5 text-gray-500" />}
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100" aria-label="Notifications">
            <Bell className="w-5 h-5 text-gray-500" />
          </button>
          <button className="p-2 rounded-full hover:bg-gray-100" aria-label="User menu">
            <UserCircle className="w-6 h-6 text-gray-500" />
          </button>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center mt-10">
        <div className="bg-blue-100 rounded-full p-4 mb-4 shadow-sm">
          <Bot className="w-12 h-12 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">How can AI assist you today?</h1>
        <p className="text-gray-500 text-lg text-center max-w-xl">Ask anything about your course materials, get summaries, study plans, or generate notes instantly.</p>
      </div>
      <div className="flex-1 flex flex-col justify-end pt-10">
        <div className="flex flex-col gap-6 mb-7 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-200">
          {/* AI Message */}
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 rounded-full p-2 mt-1 shrink-0">
              <Bot className="w-6 h-6 text-blue-600" />
            </div>
            <div className="bg-gray-100 rounded-2xl px-5 py-3 shadow-sm max-w-lg text-gray-700">
              Hello! I’m your AI assistant. How can I help you with your studies today?
            </div>
          </div>
          {/* User Message */}
          <div className="flex items-start gap-3 justify-end">
            <div className="bg-blue-600 rounded-2xl px-5 py-3 shadow-sm max-w-lg text-white">
              Can you summarize the key concepts of Glial Cells from my uploaded notes?
            </div>
          </div>
        </div>
        <div className="relative pt-6 mt-auto">
          <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex gap-4 w-max">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-700 font-medium hover:bg-gray-50 transition">
              <Sparkles className="w-4 h-4 text-blue-600" /> Summarize
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-700 font-medium hover:bg-gray-50 transition">
              <BookOpen className="w-4 h-4 text-blue-600" /> Study Plan
            </button>
            <button className="flex items-center gap-2 px-5 py-2.5 bg-white rounded-2xl shadow-sm border border-gray-100 text-gray-700 font-medium hover:bg-gray-50 transition">
              <FileText className="w-4 h-4 text-blue-600" /> Generate Notes
            </button>
          </div>
          <div className="relative flex items-center">
            <span className="absolute left-5 text-gray-400">
              <Paperclip className="w-5 h-5" />
            </span>
            <input
              type="text"
              placeholder="Type your message..."
              className="w-full pl-14 pr-16 py-4 rounded-2xl bg-white shadow-sm border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700 text-base placeholder-gray-400"
            />
            <button className="absolute right-3 bg-[#2563EB] hover:bg-blue-700 text-white rounded-full p-2.5 shadow-md transition" aria-label="Send">
              <Send className="w-5 h-5 ml-0.5" />
            </button>
          </div>
        </div>
      </div>
      <div className="pt-8 text-center text-xs text-gray-400">
        AI can make mistakes. Verify important information.
      </div>
    </div>
  );
};

export default AIAssistant;
