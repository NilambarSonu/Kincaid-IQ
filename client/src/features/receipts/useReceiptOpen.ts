import { createContext, useContext } from "react";

export interface ReceiptOpenState {
  openReceiptId: string | null;
  openReceipt: (claimId: string) => void;
  closeReceipt: () => void;
}

export const ReceiptOpenContext = createContext<ReceiptOpenState>({
  openReceiptId: null,
  openReceipt: () => undefined,
  closeReceipt: () => undefined,
});

export function useReceiptOpen(): ReceiptOpenState {
  return useContext(ReceiptOpenContext);
}
