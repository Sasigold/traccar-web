import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import { List } from 'react-window';
import { devicesActions } from '../store';
import { useAsyncTask } from '../reactHelper';
import DeviceRow from './DeviceRow';
import fetchOrThrow from '../common/util/fetchOrThrow';
import { tokenizeSearch } from '../common/util/deviceSearch';
import usePersistedState from '../common/util/usePersistedState';
import GroupHeaderRow from './GroupHeaderRow';
import { groupRows, rowOfDevice } from './groupRows';

const ROW_HEIGHT = 72;
const HEADER_HEIGHT = 44;

const useStyles = makeStyles()((theme) => ({
  list: {
    height: '100%',
  },
  listInner: {
    position: 'relative',
    margin: theme.spacing(1.5, 0),
  },
}));

const DeviceList = ({ devices, keyword = '', favorites, grouped = false }) => {
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

  // LIV-22: by group, with a header per group that folds; folded groups are remembered.
  const groups = useSelector((state) => state.groups.items);
  const [collapsed, setCollapsed] = usePersistedState('collapsedGroups', []);
  const rows = useMemo(
    () => (grouped ? groupRows(devices, groups, collapsed) : null),
    [grouped, devices, groups, collapsed],
  );
  const toggleGroup = (groupId) =>
    setCollapsed(
      collapsed.includes(groupId)
        ? collapsed.filter((id) => id !== groupId)
        : [...collapsed, groupId],
    );
  // The vehicles the keyboard moves over (not those in a folded group), and their list rows.
  const visible = rows ? rows.filter((row) => row.type === 'device').map((row) => row.index) : null;
  const listIndexOf = (deviceIndex) => (rows ? rowOfDevice(rows, deviceIndex) : deviceIndex);

  // LIV-30: a roving tab stop. Tab enters the list once; the arrows, Home and End move between
  // rows (scrolling the virtual list so the row exists), Enter or Space selects.
  const onKeyDown = (event) => {
    const order = visible || devices.map((_, index) => index);
    const at = Math.max(0, order.indexOf(current));
    const moves = {
      ArrowDown: at + 1,
      ArrowUp: at - 1,
      Home: 0,
      End: order.length - 1,
      PageDown: at + 5,
      PageUp: at - 5,
    };
    if (!(event.key in moves) || !event.target.closest?.('[data-row]') || !order.length) return;
    event.preventDefault();
    const next = order[Math.max(0, Math.min(order.length - 1, moves[event.key]))];
    setFocusIndex(next);
    listRef.current?.scrollToRow({ index: listIndexOf(next), align: 'smart', behavior: 'auto' });
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
    const index = listIndexOf(devices.findIndex((device) => device.id === selectedId));
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
      rowComponent={rows ? GroupHeaderRow : DeviceRow}
      rowCount={rows ? rows.length : devices.length}
      rowHeight={
        rows ? (index) => (rows[index].type === 'group' ? HEADER_HEIGHT : ROW_HEIGHT) : ROW_HEIGHT
      }
      rowProps={
        rows
          ? { devices, tokens, favorites, focusIndex: current, rows, onToggle: toggleGroup }
          : { devices, tokens, favorites, focusIndex: current }
      }
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      overscanCount={5}
    />
  );
};

export default DeviceList;
