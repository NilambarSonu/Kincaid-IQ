import { useCallback } from "react";
import { usePersistentState } from "./use-persistent-state";

const ANALYST_KEY = "kiq.export.analystName";
const LOGO_KEY = "kiq.export.logoDataUrl";
const LOGO_NAME_KEY = "kiq.export.logoName";

export interface ExportProfile {
  analystName: string;
  logoDataUrl: string;
  logoName: string;
}

export interface UseExportProfile extends ExportProfile {
  setAnalystName: (v: string) => void;
  setLogo: (dataUrl: string, fileName: string) => void;
  clearLogo: () => void;
  reset: () => void;
  hasSavedDefaults: boolean;
}

export function useExportProfile(): UseExportProfile {
  const [analystName, setAnalystName] = usePersistentState<string>(ANALYST_KEY, "");
  const [logoDataUrl, setLogoDataUrl] = usePersistentState<string>(LOGO_KEY, "");
  const [logoName, setLogoName] = usePersistentState<string>(LOGO_NAME_KEY, "");

  const setLogo = useCallback((dataUrl: string, fileName: string) => {
    setLogoDataUrl(dataUrl);
    setLogoName(fileName);
  }, [setLogoDataUrl, setLogoName]);

  const clearLogo = useCallback(() => {
    setLogoDataUrl("");
    setLogoName("");
  }, [setLogoDataUrl, setLogoName]);

  const reset = useCallback(() => {
    setAnalystName("");
    setLogoDataUrl("");
    setLogoName("");
  }, [setAnalystName, setLogoDataUrl, setLogoName]);

  return {
    analystName,
    logoDataUrl,
    logoName,
    setAnalystName,
    setLogo,
    clearLogo,
    reset,
    hasSavedDefaults: Boolean(analystName || logoDataUrl),
  };
}
