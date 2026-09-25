"use client";

import EmailBatchCard from "@/components/EmailBatchCard";

export default function FinalizeButton() {
  return (
    <EmailBatchCard
      endpoint="/api/finalize"
      title="Finalize Event"
      description="Computes attendance % and emails certificates / notices."
      buttonLabel="Finalize & Send Certificates"
      confirmText="Finalize the event and email students their results? This sends real emails."
      showEligibility
    />
  );
}
