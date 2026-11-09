import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import { highlightParts } from '../util/deviceSearch';

const useStyles = makeStyles()((theme) => ({
  // An aqua tint behind the text (never aqua text): it stays visible on the ice tile of the
  // selected row and on dark surfaces.
  mark: {
    backgroundColor: alpha(theme.palette.brand.aqua, 0.32),
    color: 'inherit',
    borderRadius: 3,
    paddingInline: 1,
  },
}));

// A text with the parts that match the search tokens marked.
const Highlight = ({ text, tokens, digits = false }) => {
  const { classes } = useStyles();
  if (!tokens?.length || text == null) {
    return text ?? null;
  }
  return highlightParts(text, tokens, digits).map((part, index) =>
    part.match ? (
      <mark key={index} className={classes.mark}>
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  );
};

export default Highlight;
