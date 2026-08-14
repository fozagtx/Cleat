import { DeskFrame } from "@/components/desk-frame";
import { InvoiceTable } from "@/components/invoice-table";

export default function BorrowerPage() {
  return (
    <DeskFrame lede="Choose the receivable you want funded." title="Invoices">
      <InvoiceTable />
    </DeskFrame>
  );
}
