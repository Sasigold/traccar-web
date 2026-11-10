// ADM-05: a form dialog does not close on a click outside it (a stray click would lose what was
// typed); Escape and its own buttons still close it.
export const keepOnBackdrop = (onClose) => (event, reason) => {
  if (reason !== 'backdropClick') {
    onClose(event, reason);
  }
};

export default keepOnBackdrop;
