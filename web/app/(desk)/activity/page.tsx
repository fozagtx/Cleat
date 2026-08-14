import { ActivityTable } from "@/components/activity-table";
import { DeskFrame } from "@/components/desk-frame";

export default function ActivityPage() {
  return (
    <DeskFrame lede="Checks and pledges, without customer names or amounts." title="History">
      <ActivityTable />
    </DeskFrame>
  );
}
