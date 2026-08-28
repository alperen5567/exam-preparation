import React from "react";
import { Clock } from "lucide-react";
import studyingThumb from "../../studying.png";

const ContextPanel: React.FC = () => {
  const [activeEntities, setActiveEntities] = React.useState<string[]>(["Glial Cells"]);

  const toggleEntity = (entity: string) => {
    setActiveEntities((prev) => (prev.includes(entity) ? prev.filter((e) => e !== entity) : [...prev, entity]));
  };

  return (
    <div className="flex flex-col h-full gap-8">
      <div className="bg-gray-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
        <div className="w-12 h-16 rounded-xl overflow-hidden bg-gray-200 flex items-center justify-center">
          <img src={studyingThumb} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-gray-700">neuroscience-notes.pdf</div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-gray-500 border border-gray-200">
              .pdf
            </span>
          </div>
          <div className="flex items-center text-xs text-gray-400 mt-1 gap-1">
            <Clock className="w-4 h-4" />
            Last updated: 2 days ago
          </div>
        </div>
      </div>
      <div>
        <div className="font-semibold text-gray-600 mb-2">Key Entities</div>
        <div className="flex flex-wrap gap-2">
          {["Glial Cells", "Synapse", "LTP"].map((entity) => (
            <button
              key={entity}
              onClick={() => toggleEntity(entity)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition border ${
                activeEntities.includes(entity)
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100"
              }`}
            >
              {entity}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1" />
      <div>
        <div className="flex justify-between items-center mb-1 text-xs text-gray-500">
          <span>AI Usage</span>
          <span>14/50 credits</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full" style={{ width: "28%" }} />
        </div>
      </div>
    </div>
  );
};

export default ContextPanel;
