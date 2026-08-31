import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { getCurrentUserId } from "@/lib/dal";
import { getTemplates } from "@/lib/queries/templates";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { CreateTemplateForm } from "@/components/templates/create-template-form";

export const metadata: Metadata = { title: "Templates" };

export default async function TemplatesPage() {
  const userId = await getCurrentUserId();
  const templates = await getTemplates(userId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Templates"
        description="Define your split once. Use it as a reference, or start a workout pre-filled from any day."
      />

      <CreateTemplateForm />

      {templates.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            No templates yet — name one above to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {templates.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/templates/${t.id}`}
              className="group focus-visible:ring-ring/50 rounded-xl outline-none focus-visible:ring-3"
            >
              <Card size="sm" className="group-hover:ring-primary/30 transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between gap-2">
                    <span className="truncate">{t.name}</span>
                    <ChevronRight className="text-muted-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-1.5">
                  {t.days.map((d) => (
                    <Badge key={d.id} variant="secondary">
                      {d.name} · {d._count.exercises}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
