import React from "react";
import { ArrowUp, Paperclip, X } from "lucide-react";

export interface PromptInputBoxProps {
  onSend?: (message: string, files?: File[]) => void;
  isLoading?: boolean;
  placeholder?: string;
  className?: string;
  storageKey?: string;
}

export const PromptInputBox = React.forwardRef<HTMLDivElement, PromptInputBoxProps>((props, ref) => {
  const { onSend = () => {}, isLoading = false, placeholder = "Type your message here...", className, storageKey } = props;
  const [input, setInput] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [input]);

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      setInput(localStorage.getItem(storageKey) || "");
    } catch {}
  }, [storageKey]);

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, input);
    } catch {}
  }, [storageKey, input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    if ((input.trim() || files.length > 0) && !isLoading) {
      onSend(input, files);
      setInput("");
      setFiles([]);
      if (storageKey) {
        try {
          localStorage.removeItem(storageKey);
        } catch {}
      }
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      const validFiles = newFiles.filter(f => f.size <= 3 * 1024 * 1024 * 1024);
      setFiles(prev => [...prev, ...validFiles]);
    }
    if (e.target) e.target.value = "";
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  return (
    <div ref={ref} className={`pib-container ${className || ""}`}>
      {files.length > 0 && (
        <div className="pib-attachments">
          {files.map((file, i) => (
            <div key={i} className="pib-attachment">
              <span style={{maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}}>{file.name}</span>
              <button className="pib-attachment-remove" onClick={() => removeFile(i)}>
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      
      <textarea
        ref={textareaRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={isLoading}
        className="pib-textarea"
        rows={1}
      />
      
      <div className="pib-actions">
        <div className="pib-left-actions">
          <button 
            className="pib-btn" 
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
            title="Attach file"
          >
            <Paperclip size={18} />
          </button>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            style={{ display: 'none' }} 
            multiple
          />
        </div>
        
        <button 
          className="pib-send-btn" 
          onClick={handleSubmit}
          disabled={isLoading || (!input.trim() && files.length === 0)}
        >
          {isLoading ? (
            <div style={{width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite'}} />
          ) : (
            <ArrowUp size={18} />
          )}
        </button>
      </div>
      
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
});

PromptInputBox.displayName = "PromptInputBox";
