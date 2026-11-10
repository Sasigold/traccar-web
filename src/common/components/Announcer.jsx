import { useEffect, useState } from 'react';
import { visuallyHidden } from '@mui/utils';

// A11-08: one place that speaks to screen readers. `announce(text)` is said when the reader is
// free (polite: a vehicle chosen, a list filtered); `announce(text, { urgent: true })` is said
// at once (assertive: a critical alert). The regions exist from the start, as screen readers
// only follow regions that were already on the page. No role: an empty alert or status would
// count as one on every page.
const listeners = new Set();

export const announce = (text, { urgent = false } = {}) => {
  if (!text) return;
  listeners.forEach((listener) => listener({ text, urgent, at: Date.now() }));
};

const Announcer = () => {
  const [polite, setPolite] = useState('');
  const [urgent, setUrgent] = useState('');

  useEffect(() => {
    let count = 0;
    const listener = (message) => {
      // An invisible mark that changes each time, so the same words twice are said twice.
      count += 1;
      const text = count % 2 ? `${message.text}\u200B` : message.text;
      (message.urgent ? setUrgent : setPolite)(text);
    };
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  return (
    <>
      <div aria-live="polite" aria-atomic="true" style={visuallyHidden}>
        {polite}
      </div>
      <div aria-live="assertive" aria-atomic="true" style={visuallyHidden}>
        {urgent}
      </div>
    </>
  );
};

export default Announcer;
