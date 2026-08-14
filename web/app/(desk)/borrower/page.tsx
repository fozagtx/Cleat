import { DeskFrame } from "@/components/desk-frame";
import { BorrowerDesk } from "@/components/borrower-desk";

export default function BorrowerPage() {
  return (
    <DeskFrame lede="Fill a demo invoice, then press Seal invoice." title="Invoices">
      <BorrowerDesk />
    </DeskFrame>
  );
}
