"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { Check, Plus, Send, Trash2, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { EntityDrawer } from "@/components/entity-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyAmount } from "@/components/money-amount";
import { ProposalModal } from "@/components/patients/proposal-modal";
import { FDI_LOWER, FDI_UPPER } from "@/lib/tooth-chart";
import { cn } from "cn";

type CourseItem = Doc<"courseItems">;

export function CourseDrawer({
  courseId,
  onClose,
}: {
  courseId: Id<"courses">;
  onClose: () => void;
}) {
  const t = useTranslations("Courses");
  const [proposalDocId, setProposalDocId] = React.useState<Id<"documents"> | null>(null);
  const data = useQuery(api.courses.getCourseWithItems, { courseId });

  if (proposalDocId) {
    return <ProposalModal documentId={proposalDocId} onDone={() => setProposalDocId(null)} />;
  }

  if (data === undefined) {
    return (
      <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
        <EntityDrawer.Header title="…" onClose={onClose} />
        <EntityDrawer.Body>
          <div className="h-40 animate-pulse rounded-lg bg-muted" />
        </EntityDrawer.Body>
      </EntityDrawer>
    );
  }
  if (data === null) {
    return (
      <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
        <EntityDrawer.Header title={t("notFound")} onClose={onClose} />
      </EntityDrawer>
    );
  }

  const { course, items } = data;
  const total = items.reduce((sum, i) => sum + i.price, 0) - course.discount;

  return (
    <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
      <EntityDrawer.Header
        title={t("title")}
        subtitle={t(`status.${course.status}`)}
        onClose={onClose}
      />
      <EntityDrawer.Body className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <CourseItemRow key={item._id} item={item} courseStatus={course.status} />
          ))}
          {items.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">{t("noItems")}</p>
          )}
        </div>

        {course.status === "draft" && <AddItemForm courseId={course._id} />}

        <div className="flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
          {course.status === "draft" ? (
            <DiscountEditor courseId={course._id} discount={course.discount} />
          ) : (
            course.discount > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>{t("discount")}</span>
                <MoneyAmount amount={-course.discount} />
              </div>
            )
          )}
          <div className="flex justify-between text-base font-bold">
            <span>{t("total")}</span>
            <MoneyAmount amount={total} />
          </div>
        </div>
      </EntityDrawer.Body>

      <EntityDrawer.Footer className="flex-col items-stretch gap-2">
        <CourseActions
          course={course}
          hasItems={items.length > 0}
          onGenerateProposal={setProposalDocId}
        />
      </EntityDrawer.Footer>
    </EntityDrawer>
  );
}

function CourseItemRow({
  item,
  courseStatus,
}: {
  item: CourseItem;
  courseStatus: Doc<"courses">["status"];
}) {
  const t = useTranslations("Courses");
  const removeItem = useMutation(api.courses.removeCourseItem);
  const completeItem = useMutation(api.courses.completeCourseItem);
  const [submitting, setSubmitting] = React.useState(false);
  const editable = courseStatus === "draft";
  // Matches completeCourseItem's own check in convex/courses.ts exactly --
  // showing this button for a merely-proposed course would fail silently
  // against a backend that correctly refuses it.
  const canComplete = courseStatus === "accepted" || courseStatus === "in_progress";

  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-sm font-semibold">
          {item.serviceName}
          {item.toothRef && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {t("tooth")} {item.toothRef.tooth}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {item.status === "completed" ? t("itemCompleted") : item.status === "cancelled" ? t("itemCancelled") : t("itemPlanned")}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <MoneyAmount amount={item.price} />
        {editable && (
          <button
            type="button"
            onClick={() => removeItem({ courseItemId: item._id })}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
        {item.status === "planned" && canComplete && (
          <Button
            size="sm"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                await completeItem({ courseItemId: item._id });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <Check className="size-3.5" /> {t("complete")}
          </Button>
        )}
      </div>
    </div>
  );
}

function AddItemForm({ courseId }: { courseId: Id<"courses"> }) {
  const t = useTranslations("Courses");
  const services = useQuery(api.services.listServices, { activeOnly: true });
  const [serviceId, setServiceId] = React.useState<Id<"services"> | "">("");
  const [tooth, setTooth] = React.useState<number | null>(null);
  const [showTeeth, setShowTeeth] = React.useState(false);
  const addItem = useMutation(api.courses.addCourseItem);

  async function handleAdd() {
    if (!serviceId) return;
    await addItem({
      courseId,
      serviceId,
      toothRef: tooth !== null ? { tooth } : undefined,
    });
    setServiceId("");
    setTooth(null);
    setShowTeeth(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3">
      <select
        value={serviceId}
        onChange={(e) => setServiceId(e.target.value as Id<"services">)}
        className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="">{t("selectService")}</option>
        {(services ?? []).map((s) => (
          <option key={s._id} value={s._id}>
            {s.name} — {s.price.toLocaleString()}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setShowTeeth((v) => !v)}
        className="text-left text-xs font-semibold text-primary"
      >
        {tooth !== null ? `${t("tooth")} ${tooth}` : t("addTooth")}
      </button>
      {showTeeth && (
        <div className="rounded-lg border border-border p-2">
          <ToothGrid row={FDI_UPPER} selected={tooth} onSelect={setTooth} />
          <ToothGrid row={FDI_LOWER} selected={tooth} onSelect={setTooth} />
        </div>
      )}

      <Button variant="outline" disabled={!serviceId} onClick={handleAdd}>
        <Plus className="size-4" /> {t("addItem")}
      </Button>
    </div>
  );
}

function ToothGrid({
  row,
  selected,
  onSelect,
}: {
  row: readonly number[];
  selected: number | null;
  onSelect: (n: number | null) => void;
}) {
  return (
    <div className="mb-1 grid grid-cols-[repeat(16,minmax(0,1fr))] gap-1">
      {row.map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onSelect(n === selected ? null : n)}
          className={cn(
            "rounded py-1 text-center text-[10px] font-semibold",
            n === selected ? "bg-status-done text-white" : "bg-muted hover:bg-muted/70",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function DiscountEditor({ courseId, discount }: { courseId: Id<"courses">; discount: number }) {
  const t = useTranslations("Courses");
  const [value, setValue] = React.useState(String(discount || ""));
  const setDiscount = useMutation(api.courses.setCourseDiscount);

  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{t("discount")}</span>
      <Input
        type="number"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setDiscount({ courseId, discount: Number(value) || 0 })}
        className="w-28 text-right"
      />
    </div>
  );
}

function CourseActions({
  course,
  hasItems,
  onGenerateProposal,
}: {
  course: Doc<"courses">;
  hasItems: boolean;
  onGenerateProposal: (documentId: Id<"documents">) => void;
}) {
  const t = useTranslations("Courses");
  const proposeCourse = useMutation(api.courses.proposeCourse);
  const acceptCourse = useMutation(api.courses.acceptCourse);
  const cancelCourse = useMutation(api.courses.cancelCourse);
  const generateProposal = useMutation(api.courses.generateCourseProposal);
  const [submitting, setSubmitting] = React.useState(false);

  async function run(fn: () => Promise<unknown>) {
    setSubmitting(true);
    try {
      await fn();
    } finally {
      setSubmitting(false);
    }
  }

  if (course.status === "draft") {
    return (
      <Button disabled={submitting || !hasItems} onClick={() => run(() => proposeCourse({ courseId: course._id }))}>
        <Send className="size-4" /> {t("propose")}
      </Button>
    );
  }
  if (course.status === "proposed") {
    return (
      <>
        <Button
          disabled={submitting}
          onClick={() =>
            run(async () => {
              const docId = await generateProposal({ courseId: course._id });
              onGenerateProposal(docId as Id<"documents">);
            })
          }
        >
          {t("generateProposal")}
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            disabled={submitting}
            onClick={() => run(() => acceptCourse({ courseId: course._id }))}
          >
            <Check className="size-4" /> {t("accept")}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={submitting}
            onClick={() => run(() => cancelCourse({ courseId: course._id }))}
          >
            <X className="size-4" /> {t("cancel")}
          </Button>
        </div>
      </>
    );
  }
  if (course.status === "accepted" || course.status === "in_progress") {
    return (
      <Button
        variant="outline"
        disabled={submitting}
        onClick={() => run(() => cancelCourse({ courseId: course._id }))}
      >
        <X className="size-4" /> {t("cancel")}
      </Button>
    );
  }
  return null;
}
