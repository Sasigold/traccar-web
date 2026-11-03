import { makeStyles } from 'tss-react/mui';
import { ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { Link } from 'react-router-dom';

const useStyles = makeStyles()((theme) => ({
  item: {
    minHeight: 40,
    paddingBlock: 6,
  },
  icon: {
    minWidth: 36,
    '& svg': {
      fontSize: 20,
    },
  },
  text: {
    margin: 0,
    '& .MuiListItemText-primary': {
      fontSize: '0.875rem',
      fontWeight: 500,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  },
  external: {
    fontSize: 14,
    color: theme.palette.text.disabled,
  },
}));

const MenuItem = ({ title, link, icon, selected, external, secondary }) => {
  const { classes } = useStyles();
  const linkProps = external
    ? { component: 'a', href: link, target: '_blank', rel: 'noreferrer' }
    : { component: Link, to: link };
  return (
    <ListItemButton {...linkProps} selected={selected} className={classes.item}>
      <ListItemIcon className={classes.icon}>{icon}</ListItemIcon>
      <ListItemText primary={title} secondary={secondary} className={classes.text} />
      {external && <OpenInNewRoundedIcon className={classes.external} />}
    </ListItemButton>
  );
};

export default MenuItem;
