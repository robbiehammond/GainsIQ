import  Button  from '../Buttons/Button';
import  Textbox  from '../Textbox/Textbox';
import  DropdownButton  from '../DropdownButton/DropdownButton';
import React, { ReactNode, MouseEventHandler } from 'react';
import "./RepEntry.css"
const RepEntry: React.FC = () => {
  return (
    <div className="repEntry">
      <Textbox />
      <DropdownButton></DropdownButton>
      <Textbox />
      <Button variant="closeButton"> X </Button>
    </ div>
  )
};

export default RepEntry;
