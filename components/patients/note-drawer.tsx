"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { PenLine } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { EntityDrawer } from "@/components/entity-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/form-field";

type NoteValue = { fieldId: string; value: unknown };
type Template = Doc<"noteTemplates">;
type Field = Template["fields"][number];

// Spec Sec8: "Note templates from field primitives." One renderer per
// primitive type, driven entirely by the template's field list -- adding a
// new seeded template never requires new UI code.
function FieldInput({
  field,
  value,
  onChange,
  signaturePlaceholder,
}: {
  field: Field;
  value: unknown;
  onChange: (next: unknown) => void;
  signaturePlaceholder: string;
}) {
  switch (field.type) {
    case "textarea":
      return (
        <textarea
          id={field.id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      );
    case "number":
      return (
        <Input
          id={field.id}
          type="number"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        />
      );
    case "date":
      return (
        <Input
          id={field.id}
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm">
          <Checkbox id={field.id} checked={Boolean(value)} onCheckedChange={(v: boolean) => onChange(v)} />
        </label>
      );
    case "radio":
      return (
        <div className="flex flex-wrap gap-3">
          {(field.options ?? []).map((opt) => (
            <label key={opt} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name={field.id}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="size-3.5 accent-[var(--color-brand-700)]"
              />
              {opt}
            </label>
          ))}
        </div>
      );
    case "dropdown":
      return (
        <select
          id={field.id}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="" disabled>
            —
          </option>
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    case "signature":
      return (
        <Input
          id={field.id}
          placeholder={signaturePlaceholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case "text":
    default:
      return (
        <Input id={field.id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />
      );
  }
}

export function NoteDrawer({
  patientId,
  appointmentId,
  editNote,
  onClose,
}: {
  patientId: Id<"patients">;
  appointmentId?: Id<"appointments">;
  editNote?: Doc<"clinicalNotes">;
  onClose: () => void;
}) {
  const t = useTranslations("Clinical");
  const templates = useQuery(api.clinicalNotes.listNoteTemplates);
  const [templateId, setTemplateId] = React.useState<Id<"noteTemplates"> | null>(
    editNote?.templateId ?? null,
  );
  const [values, setValues] = React.useState<Map<string, unknown>>(
    () => new Map((editNote?.values ?? []).map((v) => [v.fieldId, v.value])),
  );
  const [submitting, setSubmitting] = React.useState(false);

  const createNote = useMutation(api.clinicalNotes.createNote);
  const updateDraft = useMutation(api.clinicalNotes.updateNoteDraft);
  const signNote = useMutation(api.clinicalNotes.signNote);

  // Only one seeded template per clinic type today -- skip the picker step
  // entirely when there's nothing to choose between. Derived at render time
  // rather than synced into state via an effect.
  const effectiveTemplateId =
    templateId ?? (!editNote && templates?.length === 1 ? templates[0]._id : null);
  const template = templates?.find((tpl) => tpl._id === effectiveTemplateId) ?? null;

  function toValuesArray(): NoteValue[] {
    return Array.from(values.entries()).map(([fieldId, value]) => ({ fieldId, value }));
  }

  async function handleSaveDraft() {
    if (!template) return;
    setSubmitting(true);
    try {
      if (editNote) {
        await updateDraft({ noteId: editNote._id, values: toValuesArray() });
      } else {
        await createNote({ patientId, templateId: template._id, appointmentId, values: toValuesArray() });
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSaveAndSign() {
    if (!template) return;
    setSubmitting(true);
    try {
      const noteId = editNote
        ? (await updateDraft({ noteId: editNote._id, values: toValuesArray() }), editNote._id)
        : await createNote({ patientId, templateId: template._id, appointmentId, values: toValuesArray() });
      await signNote({ noteId });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
      <EntityDrawer.Header
        title={template ? template.name : t("newNote")}
        subtitle={template ? undefined : t("chooseTemplate")}
        onClose={onClose}
      />
      <EntityDrawer.Body className="flex flex-col gap-4">
        {!template ? (
          <div className="flex flex-col gap-2">
            {(templates ?? []).map((tpl) => (
              <button
                key={tpl._id}
                type="button"
                onClick={() => setTemplateId(tpl._id)}
                className="rounded-lg border border-border px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted"
              >
                {tpl.name}
              </button>
            ))}
          </div>
        ) : (
          template.fields.map((field) => (
            <FormField key={field.id} label={field.label} htmlFor={field.id}>
              <FieldInput
                field={field}
                value={values.get(field.id)}
                onChange={(next) => setValues((prev) => new Map(prev).set(field.id, next))}
                signaturePlaceholder={t("signaturePlaceholder")}
              />
            </FormField>
          ))
        )}
      </EntityDrawer.Body>
      {template && (
        <EntityDrawer.Footer className="flex-col items-stretch gap-2">
          <Button disabled={submitting} onClick={handleSaveAndSign} className="w-full">
            <PenLine className="size-4" /> {t("saveAndSign")}
          </Button>
          <Button variant="outline" disabled={submitting} onClick={handleSaveDraft} className="w-full">
            {t("saveDraft")}
          </Button>
        </EntityDrawer.Footer>
      )}
    </EntityDrawer>
  );
}
