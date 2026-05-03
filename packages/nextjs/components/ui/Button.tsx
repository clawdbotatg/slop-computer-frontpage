import React from "react";

type Variant = "default" | "primary";

type CommonProps = {
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
};

type ButtonAsButton = CommonProps & {
  as?: "button";
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

type ButtonAsAnchor = CommonProps & {
  as: "a";
  href: string;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "children" | "href">;

export type ButtonProps = ButtonAsButton | ButtonAsAnchor;

const buttonClass = (variant: Variant, className?: string) =>
  `slop-button ${variant === "primary" ? "slop-button--primary" : ""} ${className ?? ""}`.trim();

export const Button = (props: ButtonProps) => {
  const variant = props.variant ?? "default";
  const cls = buttonClass(variant, props.className);

  if (props.as === "a") {
    const { children, href, target, rel, onClick, id, role, "aria-label": ariaLabel } = props;
    return (
      <a
        className={cls}
        href={href}
        target={target}
        rel={rel}
        onClick={onClick}
        id={id}
        role={role}
        aria-label={ariaLabel}
      >
        {children}
      </a>
    );
  }

  const { children, type, onClick, disabled, id, name, "aria-label": ariaLabel } = props;
  return (
    <button
      className={cls}
      type={type ?? "button"}
      onClick={onClick}
      disabled={disabled}
      id={id}
      name={name}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
};
