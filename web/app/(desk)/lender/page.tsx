import { DeskFrame } from "@/components/desk-frame";
import { LenderDesk } from "@/components/lender-desk";

export default function LenderPage() {
  return (
    <DeskFrame lede="Check one invoice without receiving the whole customer list." title="Review an invoice">
      <LenderDesk />
    </DeskFrame>
  );
}
