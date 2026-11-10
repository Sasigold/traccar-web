import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  alreadySaved,
  enqueue,
  flushOutbox,
  listOutbox,
  registerOutboxKind,
  sendFiles,
  sendItem,
  memoryOutboxForTests,
} from '../outbox';

vi.stubGlobal('window', new EventTarget());

describe('outbox (ADM-10)', () => {
  beforeEach(() => memoryOutboxForTests());

  it('keeps an item until it is sent, and repeats only what was not done', async () => {
    const rows = new Set();
    const uploads = [];
    let online = false;
    registerOutboxKind('report', async (item, mark) => {
      if (!online) throw new Error('offline');
      if (!item.saved) {
        rows.add(item.payload.id);
        await mark({ saved: true });
      }
      await sendFiles(item, mark, async (file) => {
        if (file.name === 'bad.jpg' && uploads.filter((name) => name === 'bad.jpg').length === 0) {
          uploads.push(file.name);
          throw new Error('timeout');
        }
        uploads.push(file.name);
      });
    });

    await enqueue('report', { id: 'r1' }, [{ name: 'a.jpg' }, { name: 'bad.jpg' }], {
      ownerId: 'p1',
    });
    expect((await flushOutbox('p1'))[0].sent).toBe(false);
    expect(await listOutbox()).toHaveLength(1);

    online = true;
    const [first] = await flushOutbox('p1');
    expect(first).toMatchObject({ sent: false, filesLeft: 1 });
    const [left] = await listOutbox();
    expect(left.saved).toBe(true);
    expect(left.files.map((file) => file.done)).toEqual([true, false]);

    expect((await flushOutbox('p1'))[0].sent).toBe(true);
    expect(await listOutbox()).toHaveLength(0);
    // The report was saved once, and the good photo went up once.
    expect(rows.size).toBe(1);
    expect(uploads.filter((name) => name === 'a.jpg')).toHaveLength(1);
  });

  it('one send at a time per item', async () => {
    let calls = 0;
    registerOutboxKind('slow', async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    const item = await enqueue('slow', {});
    await Promise.all([sendItem(item), sendItem(item)]);
    expect(calls).toBe(1);
  });

  it("sends only what the signed-in user queued, never another driver's report", async () => {
    const sent = [];
    registerOutboxKind('owned', async (item) => {
      sent.push(item.payload.id);
    });
    await enqueue('owned', { id: 'dana' }, [], { ownerId: 'p-dana' });
    // An item from before owners were kept: its incident's reporter is its owner.
    await enqueue('owned', { id: 'old', incident: { reported_by: 'p-dana' } });
    await enqueue('owned', { id: 'yossi' }, [], { ownerId: 'p-yossi' });
    expect(await flushOutbox()).toEqual([]);
    await flushOutbox('p-yossi');
    expect(sent).toEqual(['yossi']);
    expect((await listOutbox('p-dana')).map((item) => item.payload.id)).toEqual(['dana', 'old']);
    await flushOutbox('p-dana');
    expect(sent).toEqual(['yossi', 'dana', 'old']);
  });

  it('a duplicate key means the row is already there', () => {
    expect(alreadySaved({ code: '23505' })).toBe(true);
    expect(alreadySaved({ code: '42501' })).toBe(false);
  });
});

describe('uploads (SEC-17)', () => {
  it('opens only images in the browser; anything else downloads', async () => {
    const { isImagePath } = await import('../../../fleet/fleetData');
    expect(isImagePath('o1/incidents/x-photo.JPG')).toBe(true);
    expect(isImagePath('o1/work-orders/x-invoice.pdf')).toBe(false);
    expect(isImagePath('o1/docs/x-page.html')).toBe(false);
    expect(isImagePath('o1/docs/x-logo.svg')).toBe(false);
  });
});
