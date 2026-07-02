import { useRef } from "react";
import { Upload } from "lucide-react";

interface UploadBoxProps {
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept?:  string;
  label?:   string;
  disabled?: boolean;
}

export default function UploadBox({
  onUpload,
  accept   = ".txt,.csv,.md,.pdf,.json,.log",
  label    = "Choose a file to upload",
  disabled = false,
}: UploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      data-testid="upload-box"
      onClick={() => !disabled && inputRef.current?.click()}
      style={{
        border:       "1.5px solid rgba(255,255,255,0.12)",
        borderRadius: 10,
        padding:      "16px 18px",
        background:   "#111540",
        cursor:       disabled ? "not-allowed" : "pointer",
        display:      "flex",
        alignItems:   "center",
        gap:          12,
        opacity:      disabled ? 0.5 : 1,
        transition:   "border-color 0.2s, background 0.2s",
      }}
      onMouseEnter={e => {
        if (!disabled)
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(155,28,46,0.6)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.12)";
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: "rgba(155,28,46,0.10)",
        border:     "1px solid rgba(155,28,46,0.28)",
        display:    "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Upload size={16} color="#9B1C2E" />
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ color: "#f0f4ff", fontSize: 13, fontWeight: 700 }}>{label}</div>
        <div style={{ color: "#8b9dd4", fontSize: 11, marginTop: 3 }}>
          {accept.split(",").join("  ")}
        </div>
      </div>

      <input
        ref={inputRef}
        data-testid="input-upload-box"
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={onUpload}
        style={{ display: "none" }}
      />
    </div>
  );
}
