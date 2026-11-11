import { createContext } from 'react';

// REP-09: the columns a report shows, for saving them with a view. ReportFilter gives a ref;
// ColumnSelect keeps it current.
const ReportColumnsContext = createContext(null);

export default ReportColumnsContext;
