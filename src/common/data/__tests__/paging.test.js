import { describe, expect, it, vi } from 'vitest';
import { fetchPaged } from '../paging';

// ARC-08: long lists are read page by page, and a cut-off is reported.
describe('paged reads', () => {
  const table = Array.from({ length: 2500 }, (_, i) => i);
  const page = vi.fn(async (from, to) => table.slice(from, to + 1));

  it('reads every page until a short one', async () => {
    const result = await fetchPaged(page);
    expect(result.rows).toHaveLength(2500);
    expect(result.truncated).toBe(false);
    expect(page).toHaveBeenCalledTimes(3);
  });

  it('says when it stopped at the ceiling', async () => {
    const result = await fetchPaged(page, { pageSize: 1000, max: 2000 });
    expect(result.rows).toHaveLength(2000);
    expect(result.truncated).toBe(true);
  });
});
