"use client";

import * as React from "react";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { EntityDrawer } from "@/components/entity-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/form-field";

type FieldType = "text" | "textarea" | "number" | "checkbox" | "radio" | "dropdown" | "date" | "signature";
type FieldDraft = { id: string; label: string; type: FieldType; optionsText: string };

const FIELD_TYPES: FieldType[] = [
  "text",
  "textarea",
  "number",
  "checkbox",
  "radio",
  "dropdown",
  "date",
  "signature",
];

// A field's `id` is a stable key that signed notes reference (NOTE_VALUE:
// {fieldId, value} in convex/clinicalNotes.ts) -- it must never change
// once a note has been recorded against it. Generating it once, randomly,
// at field-creation time (never re-derived from the label) means editing
// a label later can't silently orphan historical note data.
function newFieldId(): string {
  return `field_${Math.random().toString(36).slice(2, 10)}`;
}

// Spec Sec13 ("Clinical -- note templates") and Sec8 ("Note templates from
// field primitives... Clinic-owned, clonable"). The seeds in
// lib/constants.ts have carried a comment since early in the build: "the
// template *builder* UI itself is a later step." This is that step.
export function ClinicalTab() {
  const t = useTranslations("Settings");
  const templates = useQuery(api.clinicalNotes.listAllNoteTemplates);
  const [editingId, setEditingId] = React.useState<Id<"noteTemplates"> | "new" | null>(null);

  if (!templates) {
    return <div className="h-40 animate-pulse rounded-[14px] bg-muted" />;
  }

  const editingTemplate =
    editingId && editingId !== "new" ? (templates.find((tpl) => tpl._id === editingId) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setEditingId("new")}>
          <Plus className="size-3.5" /> {t("newTemplate")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-[14px] border border-border bg-card">
        {templates.length === 0 ? (
          <p className="p-[18px] text-sm text-muted-foreground">{t("noTemplates")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {templates.map((tpl) => (
              <li key={tpl._id}>
                <button
                  type="button"
                  onClick={() => setEditingId(tpl._id)}
                  className="flex w-full items-center gap-3 px-[18px] py-3 text-left hover:bg-muted/40"
                >
                  <div className="grow">
                    <div className={`text-sm font-semibold ${!tpl.active ? "text-muted-foreground line-through" : ""}`}>
                      {tpl.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("fieldCount", { count: tpl.fields.length })}
                    </div>
                  </div>
                  {!tpl.active && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t("inactive")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {editingId === "new" && <NoteTemplateDrawer template={null} onClose={() => setEditingId(null)} />}
      {editingTemplate && <NoteTemplateDrawer template={editingTemplate} onClose={() => setEditingId(null)} />}
    </div>
  );
}

function NoteTemplateDrawer({
  template,
  onClose,
}: {
  template: Doc<"noteTemplates"> | null;
  onClose: () => void;
}) {
  const t = useTranslations("Settings");
  const createNoteTemplate = useMutation(api.clinicalNotes.createNoteTemplate);
  const updateNoteTemplate = useMutation(api.clinicalNotes.updateNoteTemplate);
  const setNoteTemplateActive = useMutation(api.clinicalNotes.setNoteTemplateActive);

  const [name, setName] = React.useState(template?.name ?? "");
  const [fields, setFields] = React.useState<FieldDraft[]>(() =>
    template ? template.fields.map((f) => ({ ...f, optionsText: (f.options ?? []).join(", ") })) : [],
  );
  const [active, setActive] = React.useState(template?.active ?? true);
  const [submitting, setSubmitting] = React.useState(false);

  function addField() {
    setFields((prev) => [...prev, { id: newFieldId(), label: "", type: "text", optionsText: "" }]);
  }

  function updateField(index: number, patch: Partial<FieldDraft>) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  function removeField(index: number) {
    setFields((prev) => prev.filter((_, i) => i !== index));
  }

  function moveField(index: number, dir: -1 | 1) {
    setFields((prev) => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  const canSubmit =
    name.trim().length > 0 &&
    fields.length > 0 &&
    fields.every((f) => f.label.trim().length > 0) &&
    !submitting;

  async function handleSave() {
    setSubmitting(true);
    try {
      const payloadFields = fields.map((f) => ({
        id: f.id,
        label: f.label.trim(),
        type: f.type,
        options:
          f.type === "radio" || f.type === "dropdown"
            ? f.optionsText
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
      }));
      if (template) {
        await updateNoteTemplate({ templateId: template._id, name: name.trim(), fields: payloadFields });
        if (active !== template.active) {
          await setNoteTemplateActive({ templateId: template._id, active });
        }
      } else {
        await createNoteTemplate({ name: name.trim(), fields: payloadFields });
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <EntityDrawer open onOpenChange={(o) => !o && onClose()}>
      <EntityDrawer.Header title={template ? t("editTemplate") : t("newTemplate")} onClose={onClose} />
      <EntityDrawer.Body className="flex flex-col gap-4">
        <FormField label={t("templateName")} htmlFor="templateName">
          <Input id="templateName" value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">{t("fields")}</span>
            <button type="button" onClick={addField} className="text-xs font-semibold text-primary">
              {t("addField")}
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {fields.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                {t("noFieldsYet")}
              </p>
            )}
            {fields.map((f, i) => (
              <div key={f.id} className="flex flex-col gap-2 rounded-lg border border-border p-2.5">
                <div className="flex items-center gap-1.5">
                  <Input
                    value={f.label}
                    onChange={(e) => updateField(i, { label: e.target.value })}
                    placeholder={t("fieldLabel")}
                    className="grow"
                  />
                  <select
                    value={f.type}
                    onChange={(e) => updateField(i, { type: e.target.value as FieldType })}
                    className="h-10 shrink-0 rounded-lg border border-input bg-card px-2 text-xs"
                  >
                    {FIELD_TYPES.map((ft) => (
                      <option key={ft} value={ft}>
                        {t(`fieldType.${ft}`)}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => moveField(i, -1)}
                    disabled={i === 0}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveField(i, 1)}
                    disabled={i === fields.length - 1}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeField(i)}
                    className="rounded p-1.5 text-status-cancel hover:bg-status-cancel-bg"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {(f.type === "radio" || f.type === "dropdown") && (
                  <Input
                    value={f.optionsText}
                    onChange={(e) => updateField(i, { optionsText: e.target.value })}
                    placeholder={t("fieldOptionsPlaceholder")}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {template && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={active} onCheckedChange={(v: boolean) => setActive(v)} />
            {t("templateActive")}
          </label>
        )}
      </EntityDrawer.Body>
      <EntityDrawer.Footer>
        <Button className="w-full" disabled={!canSubmit} onClick={handleSave}>
          {t("save")}
        </Button>
      </EntityDrawer.Footer>
    </EntityDrawer>
  );
}
