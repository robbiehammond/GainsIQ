import React, { ReactNode, MouseEventHandler } from 'react';

interface ButtonProps {
  variant: string
  children: ReactNode; 
  onClick?: MouseEventHandler<HTMLButtonElement>; 
}

const Button: React.FC<ButtonProps> = ({ children, variant, onClick }) => {
  return (
    <button className={variant} onClick={onClick}>
      {children}
    </button>
  );
};

export default Button;
