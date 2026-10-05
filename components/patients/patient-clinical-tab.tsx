"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { Lock, Pencil, PlusCircle, ShieldAlert } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { NoteDrawer } from "@/components/patients/note-drawer";
import { formatDateTime } from "@/lib/patient-format";

type Note = Doc<"clinicalNotes">;

export function PatientClinicalTab({ patientId }: { patientId: Id<"patients"> }) {
  const t = useTranslations("Clinical");
  const me = useQuery(api.users.me);

  // Backend already gates listNotesForPatient/createNote/etc behind
  // requireCanViewClinicalNotes -- this is defense in depth so an assistant
  // sees an explicit explanation instead of an empty list or a thrown error.
  if (me?.role === "assistant") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-[14px] border border-dashed border-border py-16 text-center">
        <ShieldAlert className="size-6 text-muted-foreground" />
        <p className="font-semibold">{t("accessDenied")}</p>
        <p className="text-sm text-muted-foreground">{t("accessDeniedHint")}</p>
      </div>
    );
  }

  return <ClinicalNotesList patientId={patientId} />;
}

function ClinicalNotesList({ patientId }: { patientId: Id<"patients"> }) {
  const t = useTranslations("Clinical");
  const notes = useQuery(api.clinicalNotes.listNotesForPatient, { patientId });
  const [drawer, setDrawer] = React.useState<"new" | Note | null>(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDrawer("new")}>
          <PlusCircle className="size-4" /> {t("newNote")}
        </Button>
      </div>

      {notes === undefined ? (
        <div className="h-32 animate-pulse rounded-[14px] bg-muted" />
      ) : notes.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("noNotes")}</p>
      ) : (
        <div className="flex flex-col gap-3">
          {notes.map((note) => (
            <NoteCard key={note._id} note={note} onEdit={() => setDrawer(note)} />
          ))}
        </div>
      )}

      {drawer && (
        <NoteDrawer
          patientId={patientId}
          editNote={drawer === "new" ? undefined : drawer}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
}

function NoteCard({ note, onEdit }: { note: Note; onEdit: () => void }) {
  const t = useTranslations("Clinical");
  const locale = useLocale();
  const [amending, setAmending] = React.useState(false);
  // `values` only stores {fieldId, value} (schema.ts) -- look the template
  // back up to render human labels instead of raw snake_case field ids.
  const templates = useQuery(api.clinicalNotes.listNoteTemplates);
  const fieldLabel = (fieldId: string) => {
    for (const tpl of templates ?? []) {
      const field = tpl.fields.find((f) => f.id === fieldId);
      if (field) return field.label;
    }
    return fieldId;
  };

  return (
    <div className="overflow-hidden rounded-[14px] border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-[18px] py-3">
        <div>
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            {note.templateName}
            {note.status === "signed" && <Lock className="size-3.5 text-status-done" />}
          </div>
          <div className="text-xs text-muted-foreground">
            {note.authorName} · {formatDateTime(note.createdAt, locale)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {note.status === "draft" ? (
            <span className="rounded-full bg-status-neutral-bg px-2 py-0.5 text-[11px] font-semibold text-status-neutral">
              {t("draft")}
            </span>
          ) : (
            <span className="rounded-full bg-status-done-bg px-2 py-0.5 text-[11px] font-semibold text-status-done">
              {t("signed")}
            </span>
          )}
          {note.status === "draft" && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="size-3.5" /> {t("edit")}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2 px-[18px] py-3 text-sm">
        {note.values
          .filter((v) => v.value !== undefined && v.value !== "" && v.value !== false)
          .map((v) => (
            <div key={v.fieldId} className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-muted-foreground">{fieldLabel(v.fieldId)}</span>
              <span className="whitespace-pre-wrap">{v.value === true ? t("yes") : String(v.value)}</span>
            </div>
          ))}
        {note.values.every((v) => v.value === undefined || v.value === "" || v.value === false) && (
          <p className="text-xs text-muted-foreground">{t("noFieldsFilled")}</p>
        )}
      </div>

      {note.status === "signed" && (
        <div className="border-t border-border px-[18px] py-3">
          {(note.amendments ?? []).map((a, i) => (
            <div key={i} className="mb-2 rounded-lg bg-muted/50 px-3 py-2 text-xs">
              <div className="mb-0.5 font-semibold text-muted-foreground">
                {t("amendedBy", { name: a.authorName, date: formatDateTime(a.createdAt, locale) })}
              </div>
              <div className="whitespace-pre-wrap">{a.text}</div>
            </div>
          ))}
          {amending ? (
            <AmendForm noteId={note._id} onDone={() => setAmending(false)} />
          ) : (
            <button type="button" onClick={() => setAmending(true)} className="text-xs font-semibold text-primary">
              {t("addAmendment")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AmendForm({ noteId, onDone }: { noteId: Id<"clinicalNotes">; onDone: () => void }) {
  const t = useTranslations("Clinical");
  const [text, setText] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const amendNote = useMutation(api.clinicalNotes.amendNote);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await amendNote({ noteId, text: text.trim() });
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        autoFocus
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        placeholder={t("amendmentPlaceholder")}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={submitting || !text.trim()} onClick={handleSubmit}>
          {t("save")}
        </Button>
        <Button size="sm" variant="outline" disabled={submitting} onClick={onDone}>
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
