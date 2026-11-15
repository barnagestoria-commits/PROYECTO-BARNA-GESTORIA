import type { Metadata } from "next"
import { BankTransferCheckout } from "@/components/checkout/bank-transfer-checkout"

export const metadata: Metadata = {
  title: "Pago por transferencia | Taxlyn",
  robots: { index: false, follow: false },
}

export default function TransferenciaCheckoutPage() {
  return <BankTransferCheckout />
}
