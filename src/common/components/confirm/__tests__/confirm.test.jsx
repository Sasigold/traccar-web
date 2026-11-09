// @vitest-environment jsdom
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { ConfirmProvider, useConfirm } from '../ConfirmProvider';
import UnsavedChangesGuard from '../UnsavedChangesGuard';
import { hasUnsavedChanges, useFormChanges } from '../unsavedChanges';
import { location, renderApp } from '../../../../test/render';

// ADM-05: one confirmation for destructive actions, and a guard for unsaved changes.
describe('confirmation', () => {
  const Remove = ({ onDone }) => {
    const confirm = useConfirm();
    return (
      <button
        type="button"
        onClick={async () =>
          onDone(
            await confirm({
              title: 'למחוק את "טנדר 12"?',
              message: 'ההיסטוריה תימחק.',
              confirmLabel: 'מחיקה',
              typeToConfirm: 'טנדר 12',
            }),
          )
        }
      >
        מחיקה
      </button>
    );
  };

  it('names the item, says what follows and waits for the typed name', async () => {
    const onDone = vi.fn();
    const { user } = await renderApp(
      <ConfirmProvider>
        <Remove onDone={onDone} />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'מחיקה' }));
    const dialog = await screen.findByRole('dialog', { name: 'למחוק את "טנדר 12"?' });
    expect(dialog).toHaveTextContent('ההיסטוריה תימחק.');
    const ok = screen.getAllByRole('button', { name: 'מחיקה' }).at(-1);
    expect(ok).toBeDisabled();
    await user.type(screen.getByRole('textbox'), 'טנדר 12');
    expect(ok).toBeEnabled();
    await user.click(ok);
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('cancels with the cancel button', async () => {
    const onDone = vi.fn();
    const { user } = await renderApp(
      <ConfirmProvider>
        <Remove onDone={onDone} />
      </ConfirmProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'מחיקה' }));
    await user.click(await screen.findByRole('button', { name: 'ביטול' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(false));
  });
});

describe('unsaved changes', () => {
  const Form = () => {
    const [name, setName] = useState('צפון');
    const navigate = useNavigate();
    useFormChanges({ name }, true);
    return (
      <>
        <input aria-label="שם" value={name} onChange={(event) => setName(event.target.value)} />
        <a
          href="/elsewhere"
          onClick={(event) => {
            event.preventDefault();
            navigate('/elsewhere');
          }}
        >
          קישור
        </a>
      </>
    );
  };

  it('asks before a link leaves a changed form, and stays when asked to', async () => {
    const { user } = await renderApp(
      <ConfirmProvider>
        <UnsavedChangesGuard />
        <Form />
      </ConfirmProvider>,
      { route: '/form' },
    );
    expect(hasUnsavedChanges()).toBe(false);
    await user.type(screen.getByLabelText('שם'), ' רחוק');
    expect(hasUnsavedChanges()).toBe(true);

    await user.click(screen.getByRole('link', { name: 'קישור' }));
    await screen.findByRole('dialog', { name: 'לצאת בלי לשמור?' });
    await user.click(screen.getByRole('button', { name: 'להישאר' }));
    expect(location.current.pathname).toBe('/form');

    await user.click(screen.getByRole('link', { name: 'קישור' }));
    await user.click(await screen.findByRole('button', { name: 'יציאה בלי לשמור' }));
    await waitFor(() => expect(location.current.pathname).toBe('/elsewhere'));
    expect(hasUnsavedChanges()).toBe(false);
  });

  it('does not ask when nothing changed', async () => {
    const { user } = await renderApp(
      <ConfirmProvider>
        <UnsavedChangesGuard />
        <Form />
      </ConfirmProvider>,
      { route: '/form' },
    );
    await user.click(screen.getByRole('link', { name: 'קישור' }));
    await waitFor(() => expect(location.current.pathname).toBe('/elsewhere'));
    await act(async () => {});
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
