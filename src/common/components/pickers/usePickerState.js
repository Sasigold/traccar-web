import { useState } from 'react';

// Open/close state shared by the pickers. The anchor is the field that was clicked.
const usePickerState = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  return {
    anchorEl,
    open: Boolean(anchorEl),
    openAt: (element) => setAnchorEl(element),
    close: () => setAnchorEl(null),
  };
};

export default usePickerState;
