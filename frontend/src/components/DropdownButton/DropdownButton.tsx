import React, { useState } from 'react';
import "./DropdownButton.css"
import "../../fonts.css"
const DropdownButton: React.FC = () => {
  const [buttonText, setButtonText] = useState("lbs");

  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setButtonText(event.target.value);
  };

  return (
    <>
        <select className="filled bold-do-font" value={buttonText} onChange={handleSelect}>
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
        </select>
    
    </>
  );
};

export default DropdownButton;
