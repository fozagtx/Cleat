import { DeskFrame } from "@/components/desk-frame";
import { BorrowerDesk } from "@/components/borrower-desk";

export default function BorrowerPage() {
  return (
    <DeskFrame lede="Choose the receivable you want funded." title="Invoices">
      <BorrowerDesk />
    </DeskFrame>
  );
}
