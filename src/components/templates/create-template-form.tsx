"use client";

import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";

import { createTemplate } from "@/lib/actions/templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      <Plus className="size-4" /> Create
    </Button>
  );
}

export function CreateTemplateForm() {
  return (
    <form action={createTemplate} className="flex flex-wrap gap-2">
      <Input
        name="name"
        required
        maxLength={80}
        placeholder="New template name (e.g. Push / Pull / Legs)"
        className="max-w-sm"
      />
      <Submit />
    </form>
  );
}
