import { DeskFrame } from "@/components/desk-frame";
import { LenderDesk } from "@/components/lender-desk";

export default function LenderPage() {
  return (
    <DeskFrame lede="Pick one invoice, press Check, then Pledge if you will fund it." title="Review an invoice">
      <LenderDesk />
    </DeskFrame>
  );
}
