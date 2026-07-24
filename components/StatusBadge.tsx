export default function StatusBadge({ status }: { status: string }) {
  const cls =
    ["running", "generating", "in_queue", "submitted", "planning", "review", "assembling"].includes(status)
      ? "b-run"
      : ["done", "completed", "approved", "published", "ready"].includes(status)
        ? "b-done"
        : ["failed", "rejected", "cancelled", "not_connected"].includes(status)
          ? "b-fail"
          : "";
  return (
    <span className={`badge ${cls}`}>
      <span className="burner" />
      {status.replace(/_/g, " ")}
    </span>
  );
}
