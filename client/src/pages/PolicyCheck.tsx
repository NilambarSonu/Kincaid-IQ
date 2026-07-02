import { useState } from "react";
import { Layout } from "@/components/Layout";
import { ShieldAlert } from "lucide-react";
import { PolicyCheckWidget } from "@/features/policy";
import FileUploadZone, { UploadedDocument } from "@/components/FileUploadZone";

export default function PolicyCheck() {
  const [uploadedDoc, setUploadedDoc] = useState<UploadedDocument | null>(null);

  return (
    <Layout>
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 max-w-4xl mx-auto">
        <div className="flex items-start gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert className="w-5 h-5 text-[#00A8FF]" />
              <h1 className="text-xl font-bold tracking-tight">Policy Check</h1>
            </div>
            <p className="text-xs text-zinc-500">
              Run the 6-stage governance pipeline against every claim · renders render_policy + trust_posture per claim
            </p>
          </div>
        </div>
        <FileUploadZone
          uploadedDoc={uploadedDoc ?? undefined}
          onDocumentReady={setUploadedDoc}
          onClear={() => setUploadedDoc(null)}
          label="Upload Policy Document"
          hint="Attach a plan document, SPD, or policy PDF to run against the governance pipeline"
          accept=".pdf,.docx,.txt"
          className="mb-6"
        />
        <PolicyCheckWidget defaultAudience="board" />
      </div>
    </Layout>
  );
}
