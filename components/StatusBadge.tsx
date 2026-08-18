"use client";
import { useLocale } from "./LocaleProvider";

export default function StatusBadge({ status }: { status: string }) {
  const { locale } = useLocale();
  const arabic: Record<string, string> = {
    running:"قيد التشغيل", generating:"جارٍ التوليد", in_queue:"في الانتظار", submitted:"تم الإرسال", planning:"قيد التخطيط",
    review:"للمراجعة", changes_requested:"تغييرات مطلوبة", assembling:"جارٍ التجميع", processing:"قيد المعالجة",
    done:"مكتمل", completed:"مكتمل", approved:"معتمد", published:"منشور", ready:"جاهز", planned:"مخطط",
    failed:"فشل", rejected:"مرفوض", cancelled:"ملغي", not_connected:"غير متصل", awaiting_approval:"بانتظار الاعتماد"
  };
  const cls =
    ["running", "generating", "in_queue", "submitted", "planning", "review", "changes_requested", "assembling", "processing", "awaiting_approval"].includes(status)
      ? "b-run"
      : ["done", "completed", "approved", "published", "ready", "planned"].includes(status)
        ? "b-done"
        : ["failed", "rejected", "cancelled", "not_connected"].includes(status)
          ? "b-fail"
          : "";
  return <span className={`badge ${cls}`}><span className="burner" />{locale === "ar" ? arabic[status] ?? status.replace(/_/g, " ") : status.replace(/_/g, " ")}</span>;
}
