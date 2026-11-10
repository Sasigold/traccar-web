// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import VehiclePeriodDialog from '../VehiclePeriodDialog';
import { location, renderApp } from '../../../test/render';

// REP-07: a vehicle in a chart of last week leads to last week, not to the live map.
const vehicle = {
  deviceId: 4,
  name: 'Courier',
  from: '2026-11-01T00:00:00Z',
  to: '2026-11-07T23:59:59Z',
};

describe('a vehicle picked in a period chart', () => {
  it('opens its trips in the period', async () => {
    const { user } = await renderApp(<VehiclePeriodDialog vehicle={vehicle} onClose={vi.fn()} />);
    await user.click(await screen.findByRole('button', { name: 'הנסיעות בתקופה' }));
    expect(location.current.pathname).toBe('/reports/trips');
    expect(new URLSearchParams(location.current.search).get('from')).toBe(
      '2026-11-01T00:00:00.000Z',
    );
  });

  it('opens the replay of the period, or the vehicle now', async () => {
    const { user, store } = await renderApp(
      <VehiclePeriodDialog vehicle={vehicle} onClose={vi.fn()} />,
    );
    await user.click(await screen.findByRole('button', { name: 'שחזור המסלול בתקופה' }));
    expect(location.current.pathname).toBe('/replay');
    const second = await renderApp(<VehiclePeriodDialog vehicle={vehicle} onClose={vi.fn()} />);
    await second.user.click(
      (await screen.findAllByRole('button', { name: 'איפה הוא עכשיו, במפה' })).at(-1),
    );
    expect(second.store.getState().devices.selectedId).toBe(4);
    void store;
  });
});
