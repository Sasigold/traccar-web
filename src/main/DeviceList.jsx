import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import { List } from 'react-window';
import { devicesActions } from '../store';
import { useAsyncTask } from '../reactHelper';
import DeviceRow from './DeviceRow';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { tokenizeSearch } from '../common/util/deviceSearch';

const useStyles = makeStyles()((theme) => ({
  list: {
    height: '100%',
  },
  listInner: {
    position: 'relative',
    margin: theme.spacing(1.5, 0),
  },
}));

const DeviceList = ({ devices, keyword = '', favorites }) => {
  'use memo'; // PRF-04
  const { classes } = useStyles();
  const dispatch = useDispatch();

  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  const tokens = useMemo(() => tokenizeSearch(keyword), [keyword]);
  const listRef = useRef(null);
  const selectedId = useSelector((state) => state.devices.selectedId);
  const selectTime = useSelector((state) => state.devices.selectTime);
  const [focusIndex, setFocusIndex] = useState(0);
  const current = Math.min(focusIndex, Math.max(devices.length - 1, 0));

  // LIV-30: a roving tab stop. Tab enters the list once; the arrows, Home and End move between
  // rows (scrolling the virtual list so the row exists), Enter or Space selects.
  const onKeyDown = (event) => {
    const moves = {
      ArrowDown: current + 1,
      ArrowUp: current - 1,
      Home: 0,
      End: devices.length - 1,
      PageDown: current + 5,
      PageUp: current - 5,
    };
    if (!(event.key in moves) || !event.target.closest?.('[data-row]')) return;
    event.preventDefault();
    const next = Math.max(0, Math.min(devices.length - 1, moves[event.key]));
    setFocusIndex(next);
    listRef.current?.scrollToRow({ index: next, align: 'smart', behavior: 'auto' });
    requestAnimationFrame(() =>
      listRef.current?.element?.querySelector(`[data-row="${next}"]`)?.focus(),
    );
  };
  const onFocus = (event) => {
    const row = event.target.closest?.('[data-row]');
    if (row) setFocusIndex(Number(row.dataset.row));
  };

  // A vehicle picked on the map or in the quick search scrolls into view in the list.
  useEffect(() => {
    if (!selectedId) {
      return;
    }
    const index = devices.findIndex((device) => device.id === selectedId);
    if (index >= 0) {
      listRef.current?.scrollToRow({ index, align: 'smart', behavior: 'auto' });
    }
    // eslint-disable-next-line @eslint-react/exhaustive-deps
  }, [selectedId, selectTime]);

  useEffect(() => {
    const interval = setInterval(forceUpdate, 60000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  useAsyncTask(
    async ({ signal }) => {
      const response = await fetchOrThrow('api/devices', { signal });
      dispatch(devicesActions.refresh(await response.json()));
    },
    [dispatch],
  );

  return (
    <List
      listRef={listRef}
      className={classes.list}
      rowComponent={DeviceRow}
      rowCount={devices.length}
      rowHeight={72}
      rowProps={{ devices, tokens, favorites, focusIndex: current }}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      overscanCount={5}
    />
  );
};

export default DeviceList;
