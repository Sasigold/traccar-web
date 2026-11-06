import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { TableRow, TableCell, TableHead, TableBody, IconButton, Tooltip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined';
import VerticalAlignBottomIcon from '@mui/icons-material/VerticalAlignBottom';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import DataTable from '../common/components/table/DataTable';
import BaseFab from '../common/components/BaseFab';
import ReportsMenu from './components/ReportsMenu';
import ReportIntro from './components/ReportIntro';
import { sessionActions } from '../store';

const useStyles = makeStyles()((theme) => ({
  columnAction: {
    width: '1%',
    paddingLeft: theme.spacing(1),
  },
}));

const LogsPage = () => {
  const { classes } = useStyles();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();
  const [autoScroll, setAutoScroll] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    dispatch(sessionActions.enableLogs(true));
    return () => dispatch(sessionActions.enableLogs(false));
  }, [dispatch]);

  const items = useSelector((state) => state.session.logs);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ block: 'end', inline: 'nearest' });
    }
  }, [autoScroll, items.length]);

  const registerDevice = (uniqueId) => {
    const query = new URLSearchParams({ uniqueId });
    navigate(`/settings/device?${query.toString()}`);
  };

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'sharedLogs']}>
      <DataTable variant="flush" toolbar={<ReportIntro padded />}>
        <TableHead>
          <TableRow>
            <TableCell className={classes.columnAction} />
            <TableCell>{t('deviceIdentifier')}</TableCell>
            <TableCell>{t('positionProtocol')}</TableCell>
            <TableCell>{t('commandData')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={index}>
              <TableCell className={classes.columnAction} padding="none">
                {item.deviceId ? (
                  <CheckCircleOutlineIcon
                    fontSize="small"
                    color="success"
                    role="img"
                    aria-label={t('a11yRegistered')}
                    aria-hidden={false}
                    sx={{ m: '5px', verticalAlign: 'middle' }}
                  />
                ) : (
                  <Tooltip title={t('loginRegister')}>
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => registerDevice(item.uniqueId)}
                    >
                      <HelpOutlineIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </TableCell>
              <TableCell>{item.uniqueId}</TableCell>
              <TableCell>{item.protocol}</TableCell>
              <TableCell>{item.data}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </DataTable>
      <div ref={bottomRef} />
      <BaseFab
        color={autoScroll ? 'primary' : 'default'}
        onClick={() => setAutoScroll(!autoScroll)}
      >
        <VerticalAlignBottomIcon />
      </BaseFab>
    </PageLayout>
  );
};

export default LogsPage;
