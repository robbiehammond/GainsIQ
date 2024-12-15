import React, { useState } from 'react';
import "./Textbox.css"
import "../../fonts.css"
const Textbox: React.FC = () => {
  const [text, setText] = useState('');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
  };

  return (
      <input
        maxLength={7}
        className='outline'
        type="text"
        id="textbox"
        value={text}
        onChange={handleChange}
        placeholder="text pl"
      />
  );
};

export default Textbox;
