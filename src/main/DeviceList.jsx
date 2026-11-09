import { useEffect, useMemo, useReducer, useRef } from 'react';
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

const DeviceList = ({ devices, keyword = '' }) => {
  const { classes } = useStyles();
  const dispatch = useDispatch();

  const [, forceUpdate] = useReducer((x) => x + 1, 0);
  const tokens = useMemo(() => tokenizeSearch(keyword), [keyword]);
  const listRef = useRef(null);
  const selectedId = useSelector((state) => state.devices.selectedId);
  const selectTime = useSelector((state) => state.devices.selectTime);

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
      rowProps={{ devices, tokens }}
      overscanCount={5}
    />
  );
};

export default DeviceList;
