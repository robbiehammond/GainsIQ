import React from 'react';
import { TextField, FormControl, InputLabel, Select, MenuItem, SelectChangeEvent } from '@mui/material';
import { grey } from '@mui/material/colors';

interface BaseFieldProps {
  label: string;
  required?: boolean;
  fullWidth?: boolean;
}

interface TextFieldProps extends BaseFieldProps {
  type: 'text' | 'number';
  value: string;
  onChange: (value: string) => void;
}

interface SelectFieldProps extends BaseFieldProps {
  type: 'select';
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

type FormFieldProps = TextFieldProps | SelectFieldProps;

const commonSx = {
  '& .MuiOutlinedInput-root': {
    backgroundColor: grey[50],
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: grey[400],
    },
  },
  '& .MuiInputLabel-root': {
    color: grey[600],
  }
};

const FormField: React.FC<FormFieldProps> = (props) => {
  const { label, required = false, fullWidth = true } = props;

  if (props.type === 'select') {
    return (
      <FormControl fullWidth={fullWidth} required={required} sx={commonSx}>
        <InputLabel>{label}</InputLabel>
        <Select
          value={props.value}
          onChange={(e: SelectChangeEvent) => props.onChange(e.target.value)}
          label={label}
        >
          {props.options.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  }

  return (
    <TextField
      fullWidth={fullWidth}
      label={label}
      type={props.type}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      required={required}
      sx={commonSx}
    />
  );
};

export default FormField;