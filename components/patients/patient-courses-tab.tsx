"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { PlusCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { MoneyAmount } from "@/components/money-amount";
import { CourseDrawer } from "@/components/patients/course-drawer";
import { formatDate } from "@/lib/patient-format";
import { cn } from "cn";

type Course = Doc<"courses">;

const STATUS_TONE: Record<Course["status"], string> = {
  draft: "bg-status-neutral-bg text-status-neutral",
  proposed: "bg-status-booked-bg text-status-booked",
  accepted: "bg-status-progress-bg text-status-progress",
  in_progress: "bg-status-progress-bg text-status-progress",
  completed: "bg-status-done-bg text-status-done",
  cancelled: "bg-status-cancel-bg text-status-cancel",
};

export function PatientCoursesTab({ patientId }: { patientId: Id<"patients"> }) {
  const t = useTranslations("Courses");
  const courses = useQuery(api.courses.listCoursesForPatient, { patientId });
  const [drawer, setDrawer] = React.useState<Id<"courses"> | null>(null);
  const createCourse = useMutation(api.courses.createCourse);

  async function handleNewCourse() {
    const id = await createCourse({ patientId });
    setDrawer(id);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={handleNewCourse}>
          <PlusCircle className="size-4" /> {t("newCourse")}
        </Button>
      </div>

      {courses === undefined ? (
        <div className="h-32 animate-pulse rounded-[14px] bg-muted" />
      ) : courses.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("noCourses")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {courses.map((course) => (
            <CourseCard key={course._id} course={course} onOpen={() => setDrawer(course._id)} />
          ))}
        </div>
      )}

      {drawer && <CourseDrawer courseId={drawer} onClose={() => setDrawer(null)} />}
    </div>
  );
}

function CourseCard({ course, onOpen }: { course: Course; onOpen: () => void }) {
  const t = useTranslations("Courses");
  const locale = useLocale();
  const items = useQuery(api.courses.getCourseWithItems, { courseId: course._id });
  const itemList = items?.items ?? [];
  const doneCount = itemList.filter((i) => i.status === "completed").length;
  const total = itemList.reduce((sum, i) => sum + i.price, 0) - course.discount;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between rounded-[14px] border border-border bg-card px-[18px] py-3.5 text-left hover:bg-muted/40"
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{t("title")}</span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_TONE[course.status])}>
            {t(`status.${course.status}`)}
          </span>
        </div>
        <div className="text-xs text-muted-foreground">
          {formatDate(course._creationTime, locale)}
          {itemList.length > 0 && ` · ${t("progress", { done: doneCount, total: itemList.length })}`}
        </div>
      </div>
      <MoneyAmount amount={total} />
    </button>
  );
}
