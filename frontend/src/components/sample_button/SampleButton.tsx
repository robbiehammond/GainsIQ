import React from 'react';
import './SampleButton.css'

// For example only. Not used in the code.

interface SampleButtonProps {
  label: string;                
  onClick?: () => void;         
  type?: 'button' | 'submit';   
  disabled?: boolean;           
  className?: string;          
}


const CustomButton: React.FC<SampleButtonProps> = ({
  label,
  onClick,
  type = 'button',
  disabled = false,
  className = '',
}) => {
  return (
    <button
      onClick={onClick}
      type={type}
      disabled={disabled}
      className={`custom-button ${className}`} 
    >
      {label}
    </button>
  );
};

export default CustomButton;