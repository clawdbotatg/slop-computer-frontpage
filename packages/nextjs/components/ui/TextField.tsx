import React from "react";

export type TextFieldProps = React.InputHTMLAttributes<HTMLInputElement>;

export const TextField = ({ className = "", ...rest }: TextFieldProps) => {
  return <input className={`slop-textfield ${className}`.trim()} {...rest} />;
};
