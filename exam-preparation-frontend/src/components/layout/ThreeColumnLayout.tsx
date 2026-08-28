import React from "react";

interface ThreeColumnLayoutProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
}

const ThreeColumnLayout: React.FC<ThreeColumnLayoutProps> = ({ left, center, right }) => {
  return (
    <div className="flex min-h-screen bg-white">
      <aside className="w-20 bg-gray-50 shadow-sm flex flex-col justify-between py-8 px-2 border-r border-gray-200 shrink-0 z-10">
        {left}
      </aside>
      <main className="flex-1 px-8 py-8 flex flex-col items-center">
        <div className="w-full max-w-5xl h-full flex flex-col">{center}</div>
      </main>
      <aside className="w-80 bg-gray-50 shadow-sm flex flex-col justify-between py-8 px-6 border-l border-gray-200 shrink-0 z-10">
        {right}
      </aside>
    </div>
  );
};

export default ThreeColumnLayout;
