import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { setTelemetryRoute } from './install';

// Tells telemetry which screen is open (FND-06): errors and measurements carry it, and analytics
// counts a page view. Only the template of the address leaves the browser.
const TelemetryRoute = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    setTelemetryRoute(pathname);
  }, [pathname]);
  return null;
};

export default TelemetryRoute;
