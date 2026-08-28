import React from "react";
import AIAssistant from "./AIAssistant";
import ContextPanel from "../context-panel/ContextPanel";
import ThreeColumnLayout from "../layout/ThreeColumnLayout";
import SidebarNav from "../layout/SidebarNav";

interface AIAssistantShellProps {
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
  onLogout?: () => void;
}

const AIAssistantShell: React.FC<AIAssistantShellProps> = ({ theme = "light", onToggleTheme = () => {}, onLogout = () => {} }) => {
  return (
    <ThreeColumnLayout
      left={<SidebarNav onLogout={onLogout} />}
      center={<AIAssistant theme={theme} onToggleTheme={onToggleTheme} />}
      right={<ContextPanel />}
    />
  );
};

export default AIAssistantShell;

