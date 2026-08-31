import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getCurrentUserId } from "@/lib/dal";
import { getExerciseCatalog } from "@/lib/queries/exercises";
import { getTemplate } from "@/lib/queries/templates";
import { TemplateEditor } from "@/components/templates/template-editor";

export const metadata: Metadata = { title: "Template" };

export default async function TemplatePage({
  params,
}: PageProps<"/dashboard/templates/[id]">) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const [template, catalog] = await Promise.all([
    getTemplate(userId, id),
    getExerciseCatalog(userId),
  ]);
  if (!template) notFound();

  return (
    <TemplateEditor
      template={template}
      catalog={catalog.map((e) => ({
        id: e.id,
        name: e.name,
        equipment: e.equipment,
        muscle: e.muscle,
      }))}
    />
  );
}
