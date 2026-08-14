"use client";

import { useState } from "react";
import { InvoiceCreateForm } from "@/components/invoice-create-form";
import { InvoiceTable } from "@/components/invoice-table";

export function BorrowerDesk() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <InvoiceCreateForm onCreated={() => setRefreshKey((value) => value + 1)} />
      <InvoiceTable refreshKey={refreshKey} />
    </div>
  );
}
