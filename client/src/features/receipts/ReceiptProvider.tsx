import { useState, ReactNode } from "react";
import { ReceiptOpenContext } from "./useReceiptOpen";

interface ReceiptProviderProps {
  children: ReactNode;
}

export function ReceiptProvider({ children }: ReceiptProviderProps) {
  const [openReceiptId, setOpenReceiptId] = useState<string | null>(null);

  return (
    <ReceiptOpenContext.Provider
      value={{
        openReceiptId,
        openReceipt: (claimId: string) => setOpenReceiptId(claimId),
        closeReceipt: () => setOpenReceiptId(null),
      }}
    >
      {children}
    </ReceiptOpenContext.Provider>
  );
}
