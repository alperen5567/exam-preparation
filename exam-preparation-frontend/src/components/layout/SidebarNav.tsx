import React from "react";
import { Home, Calendar, BookOpen, Bot, FileText, Layers, User, LogOut } from "lucide-react";

const navItems = [
  { icon: <Home className="w-5 h-5" />, label: "Dashboard" },
  { icon: <Calendar className="w-5 h-5" />, label: "Timetable" },
  { icon: <BookOpen className="w-5 h-5" />, label: "My Classes" },
  { icon: <Bot className="w-5 h-5" />, label: "AI Assistant", active: true },
  { icon: <FileText className="w-5 h-5" />, label: "Generate Quiz" },
  { icon: <Layers className="w-5 h-5" />, label: "Flashcards" },
  { icon: <User className="w-5 h-5" />, label: "Profile" },
];

interface SidebarNavProps {
  onLogout?: () => void;
}

const SidebarNav: React.FC<SidebarNavProps> = ({ onLogout = () => {} }) => {
  return (
    <nav className="flex flex-col h-full justify-between">
      <ul className="flex flex-col gap-6 items-center">
        {navItems.map((item) => (
          <li key={item.label}>
            <button
              className={`p-3 rounded-2xl transition ${
                item.active ? "bg-blue-100 text-blue-600" : "text-gray-500 hover:bg-blue-50 hover:text-blue-600"
              }`}
              aria-label={item.label}
            >
              {item.icon}
            </button>
          </li>
        ))}
      </ul>
      <button
        className="p-3 rounded-2xl text-gray-400 hover:bg-red-50 hover:text-red-500 transition flex items-center justify-center"
        aria-label="Logout"
        onClick={onLogout}
      >
        <LogOut className="w-5 h-5" />
      </button>
    </nav>
  );
};

export default SidebarNav;
