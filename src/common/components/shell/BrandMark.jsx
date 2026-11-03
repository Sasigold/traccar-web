import { useId } from 'react';
import { useTheme } from '@mui/material/styles';

// Compact app mark: a pin on the brand gradient, used when the rail is collapsed.
const BrandMark = ({ size = 28, className }) => {
  const theme = useTheme();
  const gradientId = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={theme.palette.primary.main} />
          <stop offset="1" stopColor={theme.palette.secondary.main} />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="128" fill={`url(#${gradientId})`} />
      <g fill="none" stroke="#ffffff" strokeWidth="34" strokeLinecap="round" strokeLinejoin="round">
        <path d="M256 420C256 420 136 300 136 206a120 120 0 0 1 240 0c0 94-120 214-120 214z" />
        <circle cx="256" cy="206" r="46" fill="#ffffff" stroke="none" />
      </g>
    </svg>
  );
};

export default BrandMark;
