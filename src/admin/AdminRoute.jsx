import { Navigate, Outlet } from 'react-router-dom';
import { useAdministrator } from '../common/util/permissions';

// The super admin area is for Traccar administrators only. The server enforces
// it too: api/devices?all=true and api/users return everything only to them.
const AdminRoute = () => (useAdministrator() ? <Outlet /> : <Navigate to="/" replace />);

export default AdminRoute;
