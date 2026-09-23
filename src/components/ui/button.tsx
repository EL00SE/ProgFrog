import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all duration-150 ease-out outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px active:scale-[0.97] data-pressed:not-aria-[haspopup]:translate-y-px data-pressed:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/92 hover:shadow-md hover:shadow-primary/35 hover:-translate-y-px data-pressed:bg-primary/85 data-pressed:shadow-xs",
        outline:
          "border-border bg-background hover:border-primary/40 hover:bg-primary/8 hover:text-primary hover:shadow-sm hover:-translate-y-px aria-expanded:bg-muted aria-expanded:text-foreground data-pressed:border-primary/40 data-pressed:bg-primary/12 dark:border-input dark:bg-input/30 dark:hover:border-primary/50 dark:hover:bg-primary/12 dark:data-pressed:bg-primary/18",
        secondary:
          "bg-secondary text-secondary-foreground shadow-xs hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_6%)] hover:shadow-sm hover:-translate-y-px aria-expanded:bg-secondary aria-expanded:text-secondary-foreground data-pressed:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_10%)]",
        ghost:
          "hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground data-pressed:bg-accent data-pressed:text-accent-foreground",
        destructive:
          "bg-destructive/10 text-destructive shadow-xs shadow-destructive/10 hover:bg-destructive/20 hover:shadow-sm hover:shadow-destructive/20 hover:-translate-y-px data-pressed:bg-destructive/25 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8 data-pressed:scale-90",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg data-pressed:scale-[0.85] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg data-pressed:scale-[0.88]",
        "icon-lg": "size-9 data-pressed:scale-90",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  pending = false,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * Waiting on the server: shows a spinner in place of the label (same width,
     * so nothing shifts) and blocks presses — at full strength, so it reads as
     * "working", not "unavailable". Ignored with `asChild`.
     */
    pending?: boolean;
  }) {
  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        data-variant={variant}
        data-size={size}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      data-variant={variant}
      data-size={size}
      data-pending={pending || undefined}
      aria-busy={pending || undefined}
      className={cn(
        buttonVariants({ variant, size, className }),
        pending && "relative disabled:opacity-100",
      )}
      {...props}
      disabled={props.disabled || pending}
    >
      {pending ? (
        <>
          <span className="invisible contents">{children}</span>
          <Loader2 aria-hidden className="absolute animate-spin" />
        </>
      ) : (
        children
      )}
    </button>
  );
}

export { Button, buttonVariants };
