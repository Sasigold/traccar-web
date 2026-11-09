import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useReportsSections } from './reportsSections';
import { rememberReport } from '../../common/util/recentReports';

// Wraps every report route and notes which report was opened, for "opened recently" on the
// reports page (REP-02). On phones the side menu is not mounted, so this lives in the route.
const ReportVisits = () => {
  const location = useLocation();
  const sections = useReportsSections();
  useEffect(() => {
    const opened = sections
      .flatMap((section) => section.items)
      .find((item) => item.match(location.pathname));
    if (opened) {
      rememberReport(opened.id);
    }
  }, [sections, location.pathname]);
  return <Outlet />;
};

export default ReportVisits;
