// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { installNumberInputGuards } from '../numberInputs';

describe('number fields (ADM-24)', () => {
  let uninstall;
  afterEach(() => {
    uninstall?.();
    document.body.innerHTML = '';
  });

  it('refuse "e" and "+", not digits', () => {
    uninstall = installNumberInputGuards(document);
    document.body.innerHTML = '<input type="number" id="n" /><input type="text" id="t" />';
    const press = (id, key) => {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      document.getElementById(id).dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(press('n', 'e')).toBe(true);
    expect(press('n', '+')).toBe(true);
    expect(press('n', '5')).toBe(false);
    expect(press('t', 'e')).toBe(false);
  });

  it('let go of focus under the wheel', () => {
    uninstall = installNumberInputGuards(document);
    document.body.innerHTML = '<input type="number" id="n" />';
    const input = document.getElementById('n');
    input.focus();
    expect(document.activeElement).toBe(input);
    input.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
    expect(document.activeElement).not.toBe(input);
  });
});
