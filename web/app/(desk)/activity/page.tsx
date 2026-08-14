import { ActivityTable } from "@/components/activity-table";
import { DeskFrame } from "@/components/desk-frame";

export default function ActivityPage() {
  return (
    <DeskFrame lede="This is where a finished check, pledge, or release shows up. Open it after Review." title="History">
      <ActivityTable />
    </DeskFrame>
  );
}
