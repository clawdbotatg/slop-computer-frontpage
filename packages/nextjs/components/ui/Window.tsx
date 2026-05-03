import React from "react";
import { TitleBar } from "./TitleBar";

interface WindowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  title: React.ReactNode;
  active?: boolean;
  titleRight?: React.ReactNode;
  showDots?: boolean;
  resize?: boolean;
  bodyClassName?: string;
}

export const Window = ({
  title,
  active = false,
  titleRight,
  showDots = true,
  resize = false,
  bodyClassName = "",
  className = "",
  children,
  ...rest
}: WindowProps) => {
  return (
    <div className={`slop-window ${className}`.trim()} {...rest}>
      <TitleBar title={title} active={active} right={titleRight} showDots={showDots} />
      <div className={bodyClassName}>{children}</div>
      {resize && <span className="slop-resize" aria-hidden />}
    </div>
  );
};
