import { useState } from 'react';
import {
  Button,
  Divider,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import OpenInFullRoundedIcon from '@mui/icons-material/OpenInFullRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { useTranslation } from '../../common/components/LocalizationProvider';
import BrandLoader from '../../common/components/brand/BrandLoader';
import { useDashboardData } from '../data/DashboardDataContext';
import { formatNumber } from '../../common/util/formatter';
import useElementSize from '../layout/useElementSize';
import { sizeClass } from '../charts/chartTheme';

const useStyles = makeStyles()((theme) => ({
  root: {
    position: 'relative',
    height: '100%',
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.surface.border}`,
    borderRadius: theme.tokens.radius.xl,
    overflow: 'hidden',
    transition: `border-color ${theme.tokens.motion.duration.base}ms, box-shadow ${theme.tokens.motion.duration.base}ms`,
    '&:hover .widget-actions, &:focus-within .widget-actions': {
      opacity: 1,
    },
    '@media (hover: none)': {
      '& .widget-actions': {
        opacity: 1,
      },
    },
  },
  editing: {
    borderStyle: 'dashed',
    borderColor: theme.palette.surface.borderStrong,
    '&:hover': {
      borderColor: alpha(theme.palette.primary.main, 0.5),
    },
  },
  dragging: {
    opacity: 0.35,
  },
  bare: {
    backgroundColor: 'transparent',
    border: 'none',
    '& > header': {
      position: 'absolute',
      insetInlineEnd: 0,
      top: 0,
      zIndex: 1,
      padding: theme.spacing(0.75),
      minHeight: 0,
    },
    '& > header .widget-titles': {
      position: 'absolute',
      width: 1,
      height: 1,
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
    },
    '& > header .MuiIconButton-root': {
      color: theme.palette.brand.paper,
    },
  },
  highlight: {
    boxShadow: `0 0 0 3px ${alpha(theme.palette.secondary.main, 0.55)}`,
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(0.5),
    padding: theme.spacing(1.25, 1, 0.5, 2),
    minHeight: 44,
  },
  handle: {
    marginInlineStart: theme.spacing(-1),
    color: theme.palette.text.secondary,
    cursor: 'grab',
    touchAction: 'none',
    '&:active': {
      cursor: 'grabbing',
    },
  },
  titles: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  title: {
    ...theme.typography.subtitle1,
    color: theme.palette.text.primary,
    margin: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  caption: {
    ...theme.typography.caption,
    color: theme.palette.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    opacity: 0,
    transition: `opacity ${theme.tokens.motion.duration.fast}ms`,
  },
  actionsVisible: {
    opacity: 1,
  },
  action: {
    color: theme.palette.text.secondary,
  },
  actionOn: {
    color: theme.palette.primary.main,
    backgroundColor: alpha(theme.palette.primary.main, 0.08),
  },
  body: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    margin: theme.spacing(0, 2, 1.5),
  },
  bodyFlush: {
    margin: 0,
  },
  fill: {
    position: 'absolute',
    inset: 0,
  },
  detail: {
    fontVariantNumeric: 'tabular-nums',
  },
  center: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    textAlign: 'center',
    color: theme.palette.text.secondary,
    ...theme.typography.body2,
    padding: theme.spacing(1),
  },
  stale: {
    opacity: 0.55,
    transition: `opacity ${theme.tokens.motion.duration.base}ms`,
  },
}));

// The card around every widget: title, caption (period / live), actions on hover or
// focus (always on touch), and the measured body handed to the content.
const WidgetFrame = ({
  id,
  title,
  caption,
  editing,
  dragging,
  highlight,
  bare = false,
  flush = false,
  table,
  onTable,
  onFocusView,
  menu = [],
  onDragHandle,
  quick,
  children,
}) => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const [anchor, setAnchor] = useState(null);
  const [ref, size] = useElementSize();
  const titleId = `widget-title-${id}`;

  return (
    <section
      className={cx(
        classes.root,
        bare && classes.bare,
        editing && classes.editing,
        dragging && classes.dragging,
        highlight && classes.highlight,
      )}
      aria-labelledby={titleId}
      data-widget-id={id}
    >
      <header className={classes.header}>
        {editing && onDragHandle && (
          <Tooltip title={t('dashboardDragHint')}>
            <IconButton
              size="small"
              className={classes.handle}
              aria-label={t('dashboardMove')}
              onPointerDown={onDragHandle}
            >
              <DragIndicatorRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <div className={cx('widget-titles', classes.titles)}>
          <h3 id={titleId} className={classes.title} title={title}>
            {title}
          </h3>
          {caption && <div className={classes.caption}>{caption}</div>}
        </div>
        <div className={cx('widget-actions', classes.actions, editing && classes.actionsVisible)}>
          {quick}
          {onTable && (
            <Tooltip title={table ? t('dashboardShowChart') : t('dashboardShowTable')}>
              <IconButton
                size="small"
                className={cx(classes.action, table && classes.actionOn)}
                aria-pressed={table}
                aria-label={t('dashboardShowTable')}
                onClick={onTable}
              >
                {table ? (
                  <InsightsRoundedIcon fontSize="small" />
                ) : (
                  <TableRowsRoundedIcon fontSize="small" />
                )}
              </IconButton>
            </Tooltip>
          )}
          {onFocusView && (
            <Tooltip title={t('dashboardMaximize')}>
              <IconButton
                size="small"
                className={classes.action}
                aria-label={t('dashboardMaximize')}
                onClick={onFocusView}
              >
                <OpenInFullRoundedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {menu.length > 0 && (
            <>
              <IconButton
                size="small"
                className={classes.action}
                aria-label={t('dashboardWidgetMenu')}
                aria-haspopup="menu"
                onClick={(event) => setAnchor(event.currentTarget)}
              >
                <MoreVertRoundedIcon fontSize="small" />
              </IconButton>
              <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
                {menu.map((item) => {
                  if (item.render) {
                    return item.render();
                  }
                  return item.divider ? (
                    <Divider key={item.key} />
                  ) : (
                    <MenuItem
                      key={item.key}
                      disabled={item.disabled}
                      selected={item.selected}
                      onClick={() => {
                        setAnchor(null);
                        item.onClick();
                      }}
                    >
                      {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
                      <ListItemText inset={!item.icon && item.inset}>{item.label}</ListItemText>
                    </MenuItem>
                  );
                })}
              </Menu>
            </>
          )}
        </div>
      </header>
      <div ref={ref} className={cx(classes.body, (flush || bare) && classes.bodyFlush)}>
        {size.width > 0 &&
          size.height > 0 &&
          children({ ...size, size: sizeClass(size.width, size.height) })}
      </div>
    </section>
  );
};

export const WidgetState = ({ state, onRetry, notice, loadingLabel, error }) => {
  const { classes } = useStyles();
  const t = useTranslation();
  // REP-17: a retry goes around the cache; too much data says how much, with the fixes.
  const data = useDashboardData();
  const retry = onRetry || data?.refreshNow;
  if (state === 'loading') {
    return (
      <div className={classes.center}>
        <BrandLoader size={44} label={loadingLabel ?? t('sharedLoading')} />
      </div>
    );
  }
  if (state === 'notice') {
    return <div className={classes.center}>{notice}</div>;
  }
  if (state === 'tooLarge') {
    const setFilters = data?.setFilters;
    return (
      <div className={classes.center}>
        <ErrorOutlineRoundedIcon color="disabled" />
        {t('dashboardTooLarge')}
        {error?.limit && (
          <span className={classes.detail}>
            {t('dashboardTooLargeDetail')
              .replace('{0}', formatNumber(error.devices))
              .replace('{1}', formatNumber(error.days))
              .replace('{2}', formatNumber(error.limit))}
          </span>
        )}
        {setFilters && data.filters.period !== 'last7' && (
          <Button
            size="small"
            onClick={() =>
              setFilters({
                ...data.filters,
                period: 'last7',
                offset: 0,
                from: undefined,
                to: undefined,
              })
            }
          >
            {t('dashboardLast7')}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className={classes.center}>
      <ErrorOutlineRoundedIcon color="disabled" />
      {t('dashboardLoadError')}
      {retry && (
        <Button size="small" onClick={retry}>
          {t('dashboardRetry')}
        </Button>
      )}
    </div>
  );
};

export const useFrameStyles = useStyles;

export default WidgetFrame;
