import DonutLargeRoundedIcon from '@mui/icons-material/DonutLargeRounded';
import PieChartRoundedIcon from '@mui/icons-material/PieChartRounded';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import StackedBarChartRoundedIcon from '@mui/icons-material/StackedBarChartRounded';
import ShowChartRoundedIcon from '@mui/icons-material/ShowChartRounded';
import AreaChartRoundedIcon from '@mui/icons-material/AreaChartRounded';
import TableRowsRoundedIcon from '@mui/icons-material/TableRowsRounded';
import NumbersRoundedIcon from '@mui/icons-material/NumbersRounded';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import AlignHorizontalLeftRoundedIcon from '@mui/icons-material/AlignHorizontalLeftRounded';
import LinearScaleRoundedIcon from '@mui/icons-material/LinearScaleRounded';
import SensorsRoundedIcon from '@mui/icons-material/SensorsRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import BuildRoundedIcon from '@mui/icons-material/BuildRounded';
import DashboardCustomizeRoundedIcon from '@mui/icons-material/DashboardCustomizeRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import ViewQuiltRoundedIcon from '@mui/icons-material/ViewQuiltRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';

const VIZ_ICONS = {
  kpi: NumbersRoundedIcon,
  meter: SpeedRoundedIcon,
  donut: DonutLargeRoundedIcon,
  pie: PieChartRoundedIcon,
  segmented: LinearScaleRoundedIcon,
  bars: AlignHorizontalLeftRoundedIcon,
  columns: BarChartRoundedIcon,
  stacked: StackedBarChartRoundedIcon,
  line: ShowChartRoundedIcon,
  area: AreaChartRoundedIcon,
  table: TableRowsRoundedIcon,
};

// The bars icon points from the inline start; it mirrors with the page like the bars do.
export const VizIcon = ({ viz, ...props }) => {
  const Icon = VIZ_ICONS[viz] ?? BarChartRoundedIcon;
  return <Icon {...props} />;
};

export const CATEGORY_ICONS = {
  live: SensorsRoundedIcon,
  activity: RouteRoundedIcon,
  fleet: BuildRoundedIcon,
  custom: DashboardCustomizeRoundedIcon,
};

const KIND_ICONS = {
  kpis: ViewQuiltRoundedIcon,
  hero: LocalShippingRoundedIcon,
  map: MapRoundedIcon,
  feed: NotificationsActiveRoundedIcon,
  table: TableChartRoundedIcon,
  expiries: VerifiedRoundedIcon,
  maintenance: BuildRoundedIcon,
};

export const PresetIcon = ({ preset, ...props }) => {
  if (preset.kind === 'chart') {
    return <VizIcon viz={preset.viz} {...props} />;
  }
  const Icon = KIND_ICONS[preset.kind] ?? DashboardCustomizeRoundedIcon;
  return <Icon {...props} />;
};
