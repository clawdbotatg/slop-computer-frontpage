import React from "react";

type Variant = "out" | "in";

interface BevelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  as?: keyof React.JSX.IntrinsicElements;
}

export const Bevel = ({ variant = "out", as: Tag = "div", className = "", children, ...rest }: BevelProps) => {
  const cls = variant === "out" ? "slop-bevel-out" : "slop-bevel-in";
  const Component = Tag as React.ElementType;
  return (
    <Component className={`${cls} ${className}`.trim()} {...rest}>
      {children}
    </Component>
  );
};
