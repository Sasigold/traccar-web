import {
  API_VERSION,
  DEFAULT_RATE,
  MAX_LIMIT,
} from '../../supabase/functions/public-api/openapi.js';

// Helpers for the public API documentation screen (INT-01). Pure, unit-tested.

export const apiBaseUrl = (fleetUrl) =>
  `${String(fleetUrl || '').replace(/\/+$/, '')}/functions/v1/public-api/${API_VERSION}`;

export const KEY_PLACEHOLDER = 'vf_…';

export const curlExample = (base, resource) =>
  `curl -H "X-API-Key: ${KEY_PLACEHOLDER}" "${base}/${resource}?limit=100"`;

// A Power Query (M) query that reads every page of a resource into a table. The address is fixed
// and the resource goes in RelativePath, so scheduled refresh works in the Power BI service.
export const powerBiQuery = (base, resource) =>
  [
    'let',
    `    BaseUrl = "${base}/",`,
    `    ApiKey = "${KEY_PLACEHOLDER}",`,
    `    Resource = "${resource}",`,
    '    GetPage = (cursor as nullable text) =>',
    '        Json.Document(',
    '            Web.Contents(',
    '                BaseUrl,',
    '                [',
    '                    RelativePath = Resource,',
    `                    Query = if cursor = null then [limit = "${MAX_LIMIT}"] else [limit = "${MAX_LIMIT}", cursor = cursor],`,
    '                    Headers = [#"X-API-Key" = ApiKey]',
    '                ]',
    '            )',
    '        ),',
    '    Pages = List.Generate(',
    '        () => GetPage(null),',
    '        each _ <> null,',
    '        each if [next_cursor] = null then null else GetPage([next_cursor])',
    '    ),',
    '    Rows = List.Combine(List.Transform(Pages, each [data])),',
    '    Result = Table.FromRecords(Rows, null, MissingField.UseNull)',
    'in',
    '    Result',
  ].join('\n');

// The organization's limits, or the defaults when no package limit was set.
export const apiLimits = (row) => ({
  perMinute: row?.per_minute ?? DEFAULT_RATE.perMinute,
  perDay: row?.per_day ?? DEFAULT_RATE.perDay,
});
