import Link from "next/link";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type PolymorphicProps<T extends ElementType> = {
  as?: T;
  className?: string;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/** Uppercase section / hero eyebrow label. */
export function Eyebrow<T extends ElementType = "p">({
  as,
  variant = "badge",
  className,
  children,
  ...rest
}: PolymorphicProps<T> & { variant?: "badge" | "section" }) {
  const Comp = as ?? "p";
  return (
    <Comp
      className={cx(
        "type-overline",
        variant === "badge" ? "landing-eyebrow" : "section-label",
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

type DisplaySize = "xl" | "l";

export function DisplayHeading<T extends ElementType = "h1">({
  as,
  size = "xl",
  className,
  children,
  ...rest
}: PolymorphicProps<T> & { size?: DisplaySize }) {
  const Comp = as ?? "h1";
  return (
    <Comp
      className={cx(
        "font-display text-balance",
        size === "xl" ? "text-display-xl" : "text-display-l",
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

type HeadingLevel = 1 | 2 | 3 | 4;

export function SectionHeading<T extends ElementType = "h2">({
  as,
  level = 2,
  className,
  children,
  ...rest
}: PolymorphicProps<T> & { level?: HeadingLevel }) {
  const Comp = as ?? "h2";
  const sizeClass =
    level === 1
      ? "text-heading-1"
      : level === 2
        ? "text-heading-2"
        : level === 3
          ? "text-heading-3"
          : "text-heading-4";
  return (
    <Comp className={cx("font-display text-balance", sizeClass, className)} {...rest}>
      {children}
    </Comp>
  );
}

export function LeadText<T extends ElementType = "p">({
  as,
  className,
  children,
  ...rest
}: PolymorphicProps<T>) {
  const Comp = as ?? "p";
  return (
    <Comp className={cx("text-lead max-w-prose-narrow text-secondary-color", className)} {...rest}>
      {children}
    </Comp>
  );
}

type BodySize = "lg" | "md" | "sm";

export function BodyText<T extends ElementType = "p">({
  as,
  size = "md",
  className,
  children,
  ...rest
}: PolymorphicProps<T> & { size?: BodySize }) {
  const Comp = as ?? "p";
  const sizeClass =
    size === "lg" ? "text-body-lg" : size === "sm" ? "text-body-sm" : "text-body";
  return (
    <Comp className={cx(sizeClass, "max-w-prose-narrow text-secondary-color", className)} {...rest}>
      {children}
    </Comp>
  );
}

export function MetricValue<T extends ElementType = "p">({
  as,
  className,
  children,
  ...rest
}: PolymorphicProps<T>) {
  const Comp = as ?? "p";
  return (
    <Comp
      className={cx(
        "font-display text-display-l tabular-nums tracking-tight text-primary-color font-semibold",
        className,
      )}
      {...rest}
    >
      {children}
    </Comp>
  );
}

type TextLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  external?: boolean;
};

export function TextLink({ href, className, children, external }: TextLinkProps) {
  const classes = cx(
    "font-semibold text-body-sm underline underline-offset-4 decoration-[color:var(--brand-orange)]/50",
    "transition-colors hover:decoration-[color:var(--brand-orange)] focus-visible:outline focus-visible:outline-2",
    "focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand-orange)]",
    className,
  );
  if (external || href.startsWith("http")) {
    return (
      <a href={href} className={classes} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
