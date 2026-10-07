import { NodeConnectionTypes, NodeApiError, NodeOperationError, type IDataObject, type IExecuteFunctions, type IHttpRequestOptions, type INodeExecutionData, type INodeType, type INodeTypeDescription, type JsonObject } from "n8n-workflow";
import { requestWithRetry } from "../../shared/http";

// Generated with ts-morph
type CredentialApplication = { credentialType: string; type: 'apiKey' | 'basic' | 'bearer' | 'oauth2' | 'custom'; location?: 'header' | 'query'; parameter?: string; injections?: Array<{ target: 'header' | 'query' | 'body'; name: string; value: string }> };
type RetryContract = { mode: string; retryConnectionFailures?: boolean; retryTimeouts?: boolean; retryRateLimits?: boolean; retryServerErrors?: boolean; maxAttempts: number; maxElapsedMs: number; baseBackoffMs: number; maxBackoffMs: number; jitterRatio: number; idempotency?: { target: 'header' | 'query' | 'body'; parameter: string } };
type PaginationContract = { style: string; page?: string; limit?: string; cursor?: string; responseCursor?: string; hasMore?: string; itemPath?: string; advancement?: string; maxPages: number; maxItems: number; maxElapsedMs: number; maxMemoryBytes: number; repeatedCursorLimit: number; repeatedPageLimit: number; pageSize: number };

function normalizeParameterValue(value: unknown): IDataObject[string] {
  if (value && typeof value === 'object' && 'value' in value) return (value as { value: IDataObject[string] }).value;
  return value as IDataObject[string];
}


type BodyFieldContract = {
  name: string;
  displayName?: string;
  description?: string;
  placeholder?: string;
  type?: string;
  format?: string;
  required?: boolean;
  minValue?: number;
  maxValue?: number;
  enum?: unknown[];
  default?: unknown;
  example?: unknown;
  pattern?: string;
  fields?: BodyFieldContract[];
  items?: BodyFieldContract;
  additionalValue?: BodyFieldContract;
  alternatives?: BodyFieldContract[];
  composition?: 'oneOf' | 'anyOf';
  representation?: string;
  nullable?: boolean;
};

function normalizeJsonValue(value: unknown, label: string, context: IExecuteFunctions, itemIndex: number): IDataObject | IDataObject[] | string | number | boolean | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      return JSON.parse(trimmed) as IDataObject | IDataObject[] | string | number | boolean | null;
    } catch (error) {
      throw new NodeOperationError(context.getNode(), `${label} must be valid JSON: ${(error as Error).message}`, { itemIndex });
    }
  }
  if (value === null || Array.isArray(value) || (value && typeof value === 'object') || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value as IDataObject | IDataObject[] | string | number | boolean | null;
  throw new NodeOperationError(context.getNode(), `${label} must be valid JSON`, { itemIndex });
}


function validateBodyValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): void {
  if (value === undefined || value === '') {
    if (contract.required) throw new NodeOperationError(context.getNode(), `${path} is required`, { itemIndex });
    return;
  }
  if (value === null) {
    if (contract.nullable) return;
    throw new NodeOperationError(context.getNode(), `${path} must not be null`, { itemIndex });
  }
  if (contract.alternatives?.length) {
    selectAlternativeValue(value, contract, path, context, itemIndex);
    return;
  }
  if (contract.type === 'string' && typeof value !== 'string') throw new NodeOperationError(context.getNode(), `${path} must be a string`, { itemIndex });
  if (contract.type === 'boolean' && typeof value !== 'boolean') throw new NodeOperationError(context.getNode(), `${path} must be a boolean`, { itemIndex });
  if (contract.type === 'number' && typeof value !== 'number') throw new NodeOperationError(context.getNode(), `${path} must be a number`, { itemIndex });
  if (contract.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value))) throw new NodeOperationError(context.getNode(), `${path} must be an integer`, { itemIndex });
  if (contract.enum?.length) {
    const enumValueMatches = (candidate: unknown): boolean => candidate === value ||
      (candidate === null && value === 'null') ||
      (candidate === 'null' && value === null) ||
      Boolean(candidate && value && typeof candidate === 'object' && typeof value === 'object' && JSON.stringify(candidate) === JSON.stringify(value));
    const scalarEnum = contract.enum.every((candidate) => candidate === null || ['string', 'number', 'boolean'].includes(typeof candidate));
    const matches = contract.type === 'array' && Array.isArray(value) && scalarEnum
      ? value.every((item) => contract.enum!.some((candidate) => candidate === item || (candidate === null && item === 'null') || (candidate === 'null' && item === null)))
      : contract.enum.some(enumValueMatches);
    if (!matches) throw new NodeOperationError(context.getNode(), `${path} must be one of: ${contract.enum.join(', ')}`, { itemIndex });
  }
  if (contract.type === 'number' || contract.type === 'integer') {
    const numeric = value as number;
    if (contract.minValue !== undefined && numeric < contract.minValue) throw new NodeOperationError(context.getNode(), `${path} must be at least ${contract.minValue}`, { itemIndex });
    if (contract.maxValue !== undefined && numeric > contract.maxValue) throw new NodeOperationError(context.getNode(), `${path} must be at most ${contract.maxValue}`, { itemIndex });
  }
  if (contract.pattern && typeof value === 'string' && !new RegExp(contract.pattern).test(value)) throw new NodeOperationError(context.getNode(), `${path} must match ${contract.pattern}`, { itemIndex });
  if (contract.format === 'email' && typeof value === 'string' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be an email address`, { itemIndex });
  if ((contract.format === 'uri' || contract.format === 'url') && typeof value === 'string') {
    try {
      new URL(value);
    } catch {
      throw new NodeOperationError(context.getNode(), `${path} must be a URL`, { itemIndex });
    }
  }
  if (contract.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value)) throw new NodeOperationError(context.getNode(), `${path} must be a UUID`, { itemIndex });
  if (contract.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON object`, { itemIndex });
    const objectValue = value as IDataObject;
    for (const child of contract.fields ?? []) validateBodyValue(objectValue[child.name], child, `${path}.${child.name}`, context, itemIndex);
    if (contract.additionalValue) {
      const known = new Set((contract.fields ?? []).map((field) => field.name));
      for (const [key, childValue] of Object.entries(objectValue)) {
        if (!known.has(key)) {
          if (contract.additionalValue.alternatives?.length && contract.additionalValue.representation === 'raw') continue;
          validateBodyValue(childValue, contract.additionalValue, `${path}.${key}`, context, itemIndex);
        }
      }
    }
  }
  if (contract.type === 'array') {
    if (!Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must be a JSON array`, { itemIndex });
    if (contract.items) value.forEach((item, index) => validateBodyValue(item, contract.items!, `${path}[${index}]`, context, itemIndex));
  }
}

function setBodyField(body: IDataObject, contract: BodyFieldContract, value: unknown, context: IExecuteFunctions, itemIndex: number): void {
  const normalized = contract.type === 'object' || contract.type === 'array' || contract.type === 'alternative' || contract.representation === 'raw'
    ? normalizeJsonValue(value, contract.displayName ?? contract.name, context, itemIndex)
    : normalizeParameterValue(value);
  const selected = contract.alternatives?.length ? selectAlternativeValue(normalized, contract, contract.name, context, itemIndex) : normalized;
  validateBodyValue(selected, { ...contract, alternatives: undefined, composition: undefined }, contract.name, context, itemIndex);
  body[contract.name] = selected as IDataObject[string];
}


function selectAlternativeValue(value: unknown, contract: BodyFieldContract, path: string, context: IExecuteFunctions, itemIndex: number): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new NodeOperationError(context.getNode(), `${path} must include an explicit schema alternative and value`, { itemIndex });
  const selectedName = String((value as IDataObject).schemaAlternative ?? '');
  const selected = (contract.alternatives ?? []).find((alternative) => alternative.name === selectedName);
  if (!selected) throw new NodeOperationError(context.getNode(), `${path} schema alternative must be one of: ${(contract.alternatives ?? []).map((alternative) => alternative.name).join(', ')}`, { itemIndex });
  const selectedValue = (value as IDataObject).value;
  validateBodyValue(selectedValue, selected, path, context, itemIndex);
  return selectedValue;
}




function selectResponseFields(value: IDataObject, fields: string[]): IDataObject {
  if (fields.length === 0) return value;
  const selected: IDataObject = {};
  if (value.id !== undefined) selected.id = value.id;
  for (const field of fields) if (value[field] !== undefined) selected[field] = value[field];
  return selected;
}

function valueAtPath(value: unknown, path: string): unknown {
  if (!path) return value;
  return path.split('.').filter(Boolean).reduce((current: unknown, segment) => {
    if (current === undefined || current === null) return undefined;
    if (Array.isArray(current)) return current[Number(segment)];
    return (current as IDataObject)[segment];
  }, value);
}

export class Datafast implements INodeType {
  description: INodeTypeDescription = {
        displayName: "DataFast",
        name: "datafast",
        icon: {
            light: "file:datafast.svg",
            dark: "file:datafast.dark.svg"
        },
        group: [],
        version: [
            1
        ],
        subtitle: "={{((JSON.parse(\"\\u007b\\\"analytics\\\":\\u007b\\\"getAnalyticsMetadata\\\":\\\"getWebsiteMetadata: analytic\\\",\\\"getAnalyticsOverview\\\":\\\"getAggregateAnalytics: analytic\\\",\\\"getAnalyticsTimeseries\\\":\\\"getTimeSeriesAnalytics: analytic\\\",\\\"getRealtimeMap\\\":\\\"getRealtimeMap: analytic\\\",\\\"getRealtimeVisitors\\\":\\\"getRealtimeVisitors: analytic\\\"\\u007d,\\\"botTraffic\\\":\\u007b\\\"createBotTrafficToken\\\":\\\"createBotTrafficRequestAuthToken: botTraffic\\\",\\\"deleteBotTrafficToken\\\":\\\"deleteBotTrafficRequestAuthToken: botTraffic\\\",\\\"getBotTrafficPages\\\":\\\"getRequestedPages: botTraffic\\\",\\\"getBotTrafficSettings\\\":\\\"getBotTrafficSettings: botTraffic\\\",\\\"getBotTrafficSummary\\\":\\\"getBotTrafficSummary: botTraffic\\\",\\\"getBotTrafficTokenStatus\\\":\\\"getBotTrafficTokenStatus: botTraffic\\\",\\\"getBotTrafficUsage\\\":\\\"getBotTrafficAccountUsage: botTraffic\\\",\\\"rotateBotTrafficToken\\\":\\\"rotateBotTrafficRequestAuthToken: botTraffic\\\",\\\"updateBotTrafficSettings\\\":\\\"updateBotTrafficSettings: botTraffic\\\"\\u007d,\\\"breakdowns\\\":\\u007b\\\"getBrowserAnalytics\\\":\\\"getBrowserAnalytics: breakdown\\\",\\\"getCampaignAnalytics\\\":\\\"getCampaignAnalytics: breakdown\\\",\\\"getCityAnalytics\\\":\\\"getCityAnalytics: breakdown\\\",\\\"getCountryAnalytics\\\":\\\"getCountryAnalytics: breakdown\\\",\\\"getDeviceAnalytics\\\":\\\"getDeviceAnalytics: breakdown\\\",\\\"getExitClickAnalytics\\\":\\\"getExitClickAnalytics: breakdown\\\",\\\"getHostnameAnalytics\\\":\\\"getHostnameAnalytics: breakdown\\\",\\\"getOperatingSystemAnalytics\\\":\\\"getOperatingSystemAnalytics: breakdown\\\",\\\"getPageAnalytics\\\":\\\"getPageAnalytics: breakdown\\\",\\\"getReferrerAnalytics\\\":\\\"getReferrerAnalytics: breakdown\\\",\\\"getRegionAnalytics\\\":\\\"getRegionAnalytics: breakdown\\\"\\u007d,\\\"funnels\\\":\\u007b\\\"getFunnelAnalytics\\\":\\\"getFunnelAnalytics: funnel\\\",\\\"listFunnels\\\":\\\"listFunnels: funnel\\\"\\u007d,\\\"goals\\\":\\u007b\\\"analyzeGoals\\\":\\\"analyzeCustomGoals: goal\\\",\\\"getGoalProperties\\\":\\\"getCustomGoalProperties: goal\\\",\\\"listGoalCustomizations\\\":\\\"listGoalCustomizations: goal\\\",\\\"listTrackedGoals\\\":\\\"listTrackedGoals: goal\\\"\\u007d,\\\"identity\\\":\\u007b\\\"identifyVisitor\\\":\\\"identifyAVisitor: identity\\\"\\u007d,\\\"notes\\\":\\u007b\\\"createNote\\\":\\\"createManualNote: note\\\",\\\"deleteNote\\\":\\\"deleteManualNote: note\\\",\\\"listNotes\\\":\\\"listManualNotes: note\\\",\\\"updateNote\\\":\\\"updateManualNote: note\\\"\\u007d,\\\"socialMentions\\\":\\u007b\\\"listMentions\\\":\\\"listSocialMentions: socialMention\\\"\\u007d,\\\"visitors\\\":\\u007b\\\"getVisitor\\\":\\\"getVisitor: visitor\\\",\\\"listVisitors\\\":\\\"listVisitors: visitor\\\"\\u007d\\u007d\"))[$parameter[\"resource\"]] || {})[$parameter[\"operation\"]] || ($parameter[\"operation\"] + \": \" + $parameter[\"resource\"])}}",
        description: "DataFast helps businesses track website visits, conversions, and revenue.",
        documentationUrl: "https://datafa.st/docs/api",
        hints: [
            {
                message: "Operation \"listNotes\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getBotTrafficPages\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getBrowserAnalytics\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getCampaignAnalytics\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getCityAnalytics\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getCountryAnalytics\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getDeviceAnalytics\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getExitClickAnalytics\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getGoalProperties\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getHostnameAnalytics\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getOperatingSystemAnalytics\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getPageAnalytics\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getReferrerAnalytics\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"getRegionAnalytics\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"listMentions\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            },
            {
                message: "Operation \"listVisitors\" looks paginated, but no explicit safe Pagination Contract is available. The generated operation remains single-page until an explicit bounded Pagination Contract is provided.",
                type: "warning",
                location: "inputPane",
                whenToDisplay: "always"
            }
        ],
        defaults: {
            name: "DataFast"
        },
        usableAsTool: true,
        inputs: [
            NodeConnectionTypes.Main
        ],
        outputs: [
            NodeConnectionTypes.Main
        ],
        credentials: [
            {
                name: "datafastApi",
                required: true
            }
        ],
        properties: [
            {
                displayName: "Resource",
                name: "resource",
                type: "options",
                noDataExpression: true,
                default: "analytics",
                options: [
                    {
                        name: "Analytic",
                        value: "analytics"
                    },
                    {
                        name: "Bot Traffic",
                        value: "botTraffic"
                    },
                    {
                        name: "Breakdown",
                        value: "breakdowns"
                    },
                    {
                        name: "Funnel",
                        value: "funnels"
                    },
                    {
                        name: "Goal",
                        value: "goals"
                    },
                    {
                        name: "Identity",
                        value: "identity"
                    },
                    {
                        name: "Note",
                        value: "notes"
                    },
                    {
                        name: "Social Mention",
                        value: "socialMentions"
                    },
                    {
                        name: "Visitor",
                        value: "visitors"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "analytics"
                        ]
                    }
                },
                default: "getAnalyticsMetadata",
                options: [
                    {
                        name: "Get Aggregate",
                        value: "getAnalyticsOverview",
                        action: "Get aggregate analytics",
                        description: "Returns aggregate metrics for a date range, or all time when dates are omitted. analytics."
                    },
                    {
                        name: "Get Realtime Map",
                        value: "getRealtimeMap",
                        action: "Get realtime map analytics",
                        description: "Requires analytics:read for account tokens where applicable"
                    },
                    {
                        name: "Get Realtime Visitors",
                        value: "getRealtimeVisitors",
                        action: "Get realtime visitors analytics",
                        description: "Requires analytics:read for account tokens where applicable"
                    },
                    {
                        name: "Get Time Series",
                        value: "getAnalyticsTimeseries",
                        action: "Get time series analytics",
                        description: "Returns time-bucketed metrics. supply startat and endat together. analytics."
                    },
                    {
                        name: "Get Website Metadata",
                        value: "getAnalyticsMetadata",
                        action: "Get website metadata analytics",
                        description: "Requires analytics:read for account tokens where applicable"
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "analytics"
                        ],
                        operation: [
                            "getAnalyticsMetadata"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Fields",
                        name: "fields",
                        type: "string",
                        default: "",
                        description: "Metadata fields: domain, timezone, name, logo, kpicolorscheme, kpi, currency"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "analytics"
                        ],
                        operation: [
                            "getAnalyticsOverview"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Fields",
                        name: "fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated response fields. omit to return all supported fields."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Fields",
                name: "fields",
                type: "string",
                default: "",
                required: true,
                description: "Comma-separated metrics to return. required for time series.",
                displayOptions: {
                    show: {
                        resource: [
                            "analytics"
                        ],
                        operation: [
                            "getAnalyticsTimeseries"
                        ]
                    }
                }
            },
            {
                displayName: "Interval",
                name: "interval",
                type: "options",
                default: "hour",
                required: true,
                description: "Time-series bucket interval",
                options: [
                    {
                        name: "Day",
                        value: "day"
                    },
                    {
                        name: "Hour",
                        value: "hour"
                    },
                    {
                        name: "Month",
                        value: "month"
                    },
                    {
                        name: "Week",
                        value: "week"
                    }
                ],
                displayOptions: {
                    show: {
                        resource: [
                            "analytics"
                        ],
                        operation: [
                            "getAnalyticsTimeseries"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "analytics"
                        ],
                        operation: [
                            "getAnalyticsTimeseries"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "analytics"
                        ],
                        operation: [
                            "getRealtimeMap"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "analytics"
                        ],
                        operation: [
                            "getRealtimeVisitors"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "botTraffic"
                        ]
                    }
                },
                default: "createBotTrafficToken",
                options: [
                    {
                        name: "Create Bot Traffic Request Auth Token",
                        value: "createBotTrafficToken",
                        action: "Create bot traffic request auth token",
                        description: "The full request-authentication token is returned only once. bot traffic."
                    },
                    {
                        name: "Delete Bot Traffic Request Auth Token",
                        value: "deleteBotTrafficToken",
                        action: "Delete bot traffic request auth token",
                        description: "Deleting the token also turns authentication enforcement off. bot traffic."
                    },
                    {
                        name: "Get Bot Traffic Account Usage",
                        value: "getBotTrafficUsage",
                        action: "Get bot traffic account usage",
                        description: "Account-wide usage endpoint; the token must have access to all websites. bot traffic."
                    },
                    {
                        name: "Get Bot Traffic Settings",
                        value: "getBotTrafficSettings",
                        action: "Get bot traffic settings",
                        description: "Requires settings:read for account tokens where applicable. bot traffic."
                    },
                    {
                        name: "Get Bot Traffic Summary",
                        value: "getBotTrafficSummary",
                        action: "Get bot traffic summary",
                        description: "Requires analytics:read for account tokens where applicable. bot traffic."
                    },
                    {
                        name: "Get Bot Traffic Token Status",
                        value: "getBotTrafficTokenStatus",
                        action: "Get bot traffic token status",
                        description: "Requires settings:read for account tokens where applicable. bot traffic."
                    },
                    {
                        name: "Get Requested Pages",
                        value: "getBotTrafficPages",
                        action: "Get requested pages bot traffic",
                        description: "Requires analytics:read for account tokens where applicable. bot traffic."
                    },
                    {
                        name: "Rotate Bot Traffic Request Auth Token",
                        value: "rotateBotTrafficToken",
                        action: "Rotate bot traffic request auth token",
                        description: "Rotation immediately invalidates the previous token. bot traffic."
                    },
                    {
                        name: "Update Bot Traffic Settings",
                        value: "updateBotTrafficSettings",
                        action: "Update bot traffic settings",
                        description: "Requires settings:write for account tokens where applicable. bot traffic."
                    }
                ]
            },
            {
                displayName: "Website ID",
                name: "websiteId",
                type: "string",
                default: "",
                required: true,
                description: "Website objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "botTraffic"
                        ],
                        operation: [
                            "createBotTrafficToken"
                        ]
                    }
                }
            },
            {
                displayName: "Website ID",
                name: "websiteId",
                type: "string",
                default: "",
                required: true,
                description: "Website objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "botTraffic"
                        ],
                        operation: [
                            "deleteBotTrafficToken"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "botTraffic"
                        ],
                        operation: [
                            "getBotTrafficPages"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Category",
                        name: "category",
                        type: "options",
                        default: "all",
                        description: "Bot traffic category",
                        options: [
                            {
                                name: "Ai Crawler",
                                value: "ai_crawler"
                            },
                            {
                                name: "All",
                                value: "all"
                            },
                            {
                                name: "Answer Fetch",
                                value: "answer_fetch"
                            },
                            {
                                name: "Search Index",
                                value: "search_index"
                            },
                            {
                                name: "Training",
                                value: "training"
                            }
                        ]
                    },
                    {
                        displayName: "Company",
                        name: "company",
                        type: "string",
                        default: "",
                        description: "Exact company name returned by the API"
                    },
                    {
                        displayName: "Crawler ID",
                        name: "crawlerId",
                        type: "string",
                        default: "",
                        description: "Exact crawler ID returned by the API"
                    },
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Interval",
                        name: "interval",
                        type: "options",
                        default: "hour",
                        description: "Bot traffic time-series bucket interval",
                        options: [
                            {
                                name: "Day",
                                value: "day"
                            },
                            {
                                name: "Hour",
                                value: "hour"
                            },
                            {
                                name: "Month",
                                value: "month"
                            },
                            {
                                name: "Week",
                                value: "week"
                            }
                        ]
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Page Search",
                        name: "pageSearch",
                        type: "string",
                        default: "",
                        description: "Filter requested pages by page path"
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Verification",
                        name: "verification",
                        type: "options",
                        default: "all",
                        description: "Bot request verification status",
                        options: [
                            {
                                name: "All",
                                value: "all"
                            },
                            {
                                name: "IP Verified",
                                value: "ip_verified"
                            },
                            {
                                name: "User Agent Only",
                                value: "user_agent_only"
                            }
                        ]
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Website ID",
                name: "websiteId",
                type: "string",
                default: "",
                required: true,
                description: "Website objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "botTraffic"
                        ],
                        operation: [
                            "getBotTrafficSettings"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "botTraffic"
                        ],
                        operation: [
                            "getBotTrafficSummary"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Category",
                        name: "category",
                        type: "options",
                        default: "all",
                        description: "Bot traffic category",
                        options: [
                            {
                                name: "Ai Crawler",
                                value: "ai_crawler"
                            },
                            {
                                name: "All",
                                value: "all"
                            },
                            {
                                name: "Answer Fetch",
                                value: "answer_fetch"
                            },
                            {
                                name: "Search Index",
                                value: "search_index"
                            },
                            {
                                name: "Training",
                                value: "training"
                            }
                        ]
                    },
                    {
                        displayName: "Company",
                        name: "company",
                        type: "string",
                        default: "",
                        description: "Exact company name returned by the API"
                    },
                    {
                        displayName: "Crawler ID",
                        name: "crawlerId",
                        type: "string",
                        default: "",
                        description: "Exact crawler ID returned by the API"
                    },
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Interval",
                        name: "interval",
                        type: "options",
                        default: "hour",
                        description: "Bot traffic time-series bucket interval",
                        options: [
                            {
                                name: "Day",
                                value: "day"
                            },
                            {
                                name: "Hour",
                                value: "hour"
                            },
                            {
                                name: "Month",
                                value: "month"
                            },
                            {
                                name: "Week",
                                value: "week"
                            }
                        ]
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Verification",
                        name: "verification",
                        type: "options",
                        default: "all",
                        description: "Bot request verification status",
                        options: [
                            {
                                name: "All",
                                value: "all"
                            },
                            {
                                name: "IP Verified",
                                value: "ip_verified"
                            },
                            {
                                name: "User Agent Only",
                                value: "user_agent_only"
                            }
                        ]
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Website ID",
                name: "websiteId",
                type: "string",
                default: "",
                required: true,
                description: "Website objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "botTraffic"
                        ],
                        operation: [
                            "getBotTrafficTokenStatus"
                        ]
                    }
                }
            },
            {
                displayName: "Website ID",
                name: "websiteId",
                type: "string",
                default: "",
                required: true,
                description: "Website objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "botTraffic"
                        ],
                        operation: [
                            "rotateBotTrafficToken"
                        ]
                    }
                }
            },
            {
                displayName: "Website ID",
                name: "websiteId",
                type: "string",
                default: "",
                required: true,
                description: "Website objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "botTraffic"
                        ],
                        operation: [
                            "updateBotTrafficSettings"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "botTraffic"
                        ],
                        operation: [
                            "updateBotTrafficSettings"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Disable Companies",
                        name: "disableCompanies",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Disable Crawler IDs",
                        name: "disableCrawlerIds",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Enable Companies",
                        name: "enableCompanies",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Enable Crawler IDs",
                        name: "enableCrawlerIds",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Excluded Crawler IDs",
                        name: "excludedCrawlerIds",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Group By",
                        name: "groupBy",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Hidden Crawlers",
                        name: "hiddenCrawlers",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Hide Dashboard Card",
                        name: "hideDashboardCard",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable hide dashboard card"
                    },
                    {
                        displayName: "Page Filter IDs",
                        name: "pageFilterIds",
                        type: "json",
                        default: []
                    },
                    {
                        displayName: "Require Auth Token",
                        name: "requireAuthToken",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable require auth token"
                    },
                    {
                        displayName: "Verified Only",
                        name: "verifiedOnly",
                        type: "boolean",
                        default: false,
                        description: "Whether to enable verified only"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "breakdowns"
                        ]
                    }
                },
                default: "getBrowserAnalytics",
                options: [
                    {
                        name: "Get Browser Analytics",
                        value: "getBrowserAnalytics",
                        action: "Get browser analytics breakdowns",
                        description: "Returns analytics grouped by this dimension. date bounds must be paired. breakdowns."
                    },
                    {
                        name: "Get Campaign Analytics",
                        value: "getCampaignAnalytics",
                        action: "Get campaign analytics breakdowns",
                        description: "Returns analytics grouped by this dimension. date bounds must be paired. breakdowns."
                    },
                    {
                        name: "Get City Analytics",
                        value: "getCityAnalytics",
                        action: "Get city analytics breakdowns",
                        description: "Returns analytics grouped by this dimension. date bounds must be paired. breakdowns."
                    },
                    {
                        name: "Get Country Analytics",
                        value: "getCountryAnalytics",
                        action: "Get country analytics breakdowns",
                        description: "Returns analytics grouped by this dimension. date bounds must be paired. breakdowns."
                    },
                    {
                        name: "Get Device Analytics",
                        value: "getDeviceAnalytics",
                        action: "Get device analytics breakdowns",
                        description: "Returns analytics grouped by this dimension. date bounds must be paired. breakdowns."
                    },
                    {
                        name: "Get Exit Click Analytics",
                        value: "getExitClickAnalytics",
                        action: "Get exit click analytics breakdowns",
                        description: "Returns analytics grouped by this dimension. date bounds must be paired. breakdowns."
                    },
                    {
                        name: "Get Hostname Analytics",
                        value: "getHostnameAnalytics",
                        action: "Get hostname analytics breakdowns",
                        description: "Returns analytics grouped by this dimension. date bounds must be paired. breakdowns."
                    },
                    {
                        name: "Get Operating System Analytics",
                        value: "getOperatingSystemAnalytics",
                        action: "Get operating system analytics breakdowns",
                        description: "Returns analytics grouped by this dimension. date bounds must be paired. breakdowns."
                    },
                    {
                        name: "Get Page Analytics",
                        value: "getPageAnalytics",
                        action: "Get page analytics breakdowns",
                        description: "Returns analytics grouped by this dimension. date bounds must be paired. breakdowns."
                    },
                    {
                        name: "Get Referrer Analytics",
                        value: "getReferrerAnalytics",
                        action: "Get referrer analytics breakdowns",
                        description: "Returns analytics grouped by this dimension. date bounds must be paired. breakdowns."
                    },
                    {
                        name: "Get Region Analytics",
                        value: "getRegionAnalytics",
                        action: "Get region analytics breakdowns",
                        description: "Returns analytics grouped by this dimension. date bounds must be paired. breakdowns."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "breakdowns"
                        ],
                        operation: [
                            "getBrowserAnalytics"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Fields",
                        name: "fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated response fields. omit to return all supported fields."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "breakdowns"
                        ],
                        operation: [
                            "getCampaignAnalytics"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Fields",
                        name: "fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated response fields. omit to return all supported fields."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "breakdowns"
                        ],
                        operation: [
                            "getCityAnalytics"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Fields",
                        name: "fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated response fields. omit to return all supported fields."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "breakdowns"
                        ],
                        operation: [
                            "getCountryAnalytics"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Fields",
                        name: "fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated response fields. omit to return all supported fields."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "breakdowns"
                        ],
                        operation: [
                            "getDeviceAnalytics"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Fields",
                        name: "fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated response fields. omit to return all supported fields."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "breakdowns"
                        ],
                        operation: [
                            "getExitClickAnalytics"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Fields",
                        name: "fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated response fields. omit to return all supported fields."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "breakdowns"
                        ],
                        operation: [
                            "getHostnameAnalytics"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Fields",
                        name: "fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated response fields. omit to return all supported fields."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "breakdowns"
                        ],
                        operation: [
                            "getOperatingSystemAnalytics"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Fields",
                        name: "fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated response fields. omit to return all supported fields."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "breakdowns"
                        ],
                        operation: [
                            "getPageAnalytics"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Fields",
                        name: "fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated response fields. omit to return all supported fields."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "breakdowns"
                        ],
                        operation: [
                            "getReferrerAnalytics"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Fields",
                        name: "fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated response fields. omit to return all supported fields."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "breakdowns"
                        ],
                        operation: [
                            "getRegionAnalytics"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Fields",
                        name: "fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated response fields. omit to return all supported fields."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "funnels"
                        ]
                    }
                },
                default: "getFunnelAnalytics",
                options: [
                    {
                        name: "Get Funnel Analytics",
                        value: "getFunnelAnalytics",
                        action: "Get funnel analytics",
                        description: "Returns step-by-step conversion analytics for an active funnel. date bounds must be paired."
                    },
                    {
                        name: "List",
                        value: "listFunnels",
                        action: "List funnels",
                        description: "Requires funnels:read for account tokens where applicable"
                    }
                ]
            },
            {
                displayName: "Funnel ID",
                name: "funnelId",
                type: "string",
                default: "",
                required: true,
                description: "Funnel objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "funnels"
                        ],
                        operation: [
                            "getFunnelAnalytics"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "funnels"
                        ],
                        operation: [
                            "getFunnelAnalytics"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Timezone (Query)",
                        name: "timezoneQuery",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Website ID",
                name: "websiteId",
                type: "string",
                default: "",
                required: true,
                description: "Website objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "funnels"
                        ],
                        operation: [
                            "listFunnels"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "goals"
                        ]
                    }
                },
                default: "analyzeGoals",
                options: [
                    {
                        name: "Analyze Custom",
                        value: "analyzeGoals",
                        action: "Analyze custom goals",
                        description: "Requires analytics:read for account tokens where applicable. goals."
                    },
                    {
                        name: "Get Custom Goal Properties",
                        value: "getGoalProperties",
                        action: "Get custom goal properties",
                        description: "Discover property names for a custom goal, or compare completions by value. eventname is required."
                    },
                    {
                        name: "List Goal Customizations",
                        value: "listGoalCustomizations",
                        action: "List goal customizations",
                        description: "Requires goals:read for account tokens where applicable"
                    },
                    {
                        name: "List Tracked",
                        value: "listTrackedGoals",
                        action: "List tracked goals",
                        description: "Requires settings:read for account tokens where applicable. goals."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "goals"
                        ],
                        operation: [
                            "analyzeGoals"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Fields",
                        name: "fields",
                        type: "string",
                        default: "",
                        description: "Comma-separated response fields. omit to return all supported fields."
                    },
                    {
                        displayName: "Filter Browser",
                        name: "filter_browser",
                        type: "string",
                        default: "",
                        description: "Browser filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter City",
                        name: "filter_city",
                        type: "string",
                        default: "",
                        description: "City filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Country",
                        name: "filter_country",
                        type: "string",
                        default: "",
                        description: "Country filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Device",
                        name: "filter_device",
                        type: "string",
                        default: "",
                        description: "Device filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Entry Page",
                        name: "filter_entry_page",
                        type: "string",
                        default: "",
                        description: "Entry-page path filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Goal",
                        name: "filter_goal",
                        type: "string",
                        default: "",
                        description: "Completed custom-goal filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Hostname",
                        name: "filter_hostname",
                        type: "string",
                        default: "",
                        description: "Hostname filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Os",
                        name: "filter_os",
                        type: "string",
                        default: "",
                        description: "Operating-system filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Page",
                        name: "filter_page",
                        type: "string",
                        default: "",
                        description: "Page path filter; page filters also support contains. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Ref",
                        name: "filter_ref",
                        type: "string",
                        default: "",
                        description: "Ref URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Referrer",
                        name: "filter_referrer",
                        type: "string",
                        default: "",
                        description: "Referrer filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Region",
                        name: "filter_region",
                        type: "string",
                        default: "",
                        description: "Region or state filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Source",
                        name: "filter_source",
                        type: "string",
                        default: "",
                        description: "Source URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Campaign",
                        name: "filter_utm_campaign",
                        type: "string",
                        default: "",
                        description: "Utm campaign filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Content",
                        name: "filter_utm_content",
                        type: "string",
                        default: "",
                        description: "Utm content filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Medium",
                        name: "filter_utm_medium",
                        type: "string",
                        default: "",
                        description: "Utm medium filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Source",
                        name: "filter_utm_source",
                        type: "string",
                        default: "",
                        description: "Utm source filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Utm Term",
                        name: "filter_utm_term",
                        type: "string",
                        default: "",
                        description: "Utm term filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Via",
                        name: "filter_via",
                        type: "string",
                        default: "",
                        description: "Via URL-parameter filter. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Filter Visit Count",
                        name: "filter_visit_count",
                        type: "string",
                        default: "",
                        description: "Visitor session count; supports is, is_not, gte, and lte. prefix values with is: or is_not: where supported."
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Event Name",
                name: "eventName",
                type: "string",
                default: "",
                required: true,
                description: "Exact custom goal name. required to query custom goal properties.",
                displayOptions: {
                    show: {
                        resource: [
                            "goals"
                        ],
                        operation: [
                            "getGoalProperties"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "goals"
                        ],
                        operation: [
                            "getGoalProperties"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Property Name",
                        name: "propertyName",
                        type: "string",
                        default: "",
                        description: "Exact case-sensitive custom goal property name"
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Website ID",
                name: "websiteId",
                type: "string",
                default: "",
                required: true,
                description: "Website objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "goals"
                        ],
                        operation: [
                            "listGoalCustomizations"
                        ]
                    }
                }
            },
            {
                displayName: "Website ID",
                name: "websiteId",
                type: "string",
                default: "",
                required: true,
                description: "Website objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "goals"
                        ],
                        operation: [
                            "listTrackedGoals"
                        ]
                    }
                }
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "identity"
                        ]
                    }
                },
                default: "identifyVisitor",
                options: [
                    {
                        name: "Identify A Visitor",
                        value: "identifyVisitor",
                        action: "Identify visitor identity",
                        description: "Links a datafast visitor to a user ID. additional top-level fields are shallow-merged into profile metadata. identity."
                    }
                ]
            },
            {
                displayName: "Datafast Visitor ID",
                name: "datafast_visitor_id",
                type: "string",
                default: "",
                required: true,
                hint: "Expected format: uuid",
                displayOptions: {
                    show: {
                        resource: [
                            "identity"
                        ],
                        operation: [
                            "identifyVisitor"
                        ]
                    }
                }
            },
            {
                displayName: "User ID",
                name: "user_id",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "identity"
                        ],
                        operation: [
                            "identifyVisitor"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "identity"
                        ],
                        operation: [
                            "identifyVisitor"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ]
                    }
                },
                default: "createNote",
                options: [
                    {
                        name: "Create Manual",
                        value: "createNote",
                        action: "Create manual note",
                        description: "Idempotencykey prevents duplicate retries while the note exists"
                    },
                    {
                        name: "Delete Manual",
                        value: "deleteNote",
                        action: "Delete manual note",
                        description: "Requires notes:write for account tokens where applicable"
                    },
                    {
                        name: "List Manual",
                        value: "listNotes",
                        action: "List manual notes",
                        description: "Requires notes:read for account tokens where applicable"
                    },
                    {
                        name: "Update Manual",
                        value: "updateNote",
                        action: "Update manual note",
                        description: "Requires notes:write for account tokens where applicable"
                    }
                ]
            },
            {
                displayName: "Website ID",
                name: "websiteId",
                type: "string",
                default: "",
                required: true,
                description: "Website objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "createNote"
                        ]
                    }
                }
            },
            {
                displayName: "Text",
                name: "text",
                type: "string",
                default: "",
                required: true,
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "createNote"
                        ]
                    }
                }
            },
            {
                displayName: "Timestamp",
                name: "timestamp",
                type: "string",
                default: "",
                required: true,
                description: "ISO 8601 timestamp or yyyy-mm-dd in website timezone",
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "createNote"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "createNote"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Idempotency Key",
                        name: "idempotencyKey",
                        type: "string",
                        default: "",
                        hint: "Expected format: ^[A-Za-z0-9._:-]+$"
                    }
                ]
            },
            {
                displayName: "Website ID",
                name: "websiteId",
                type: "string",
                default: "",
                required: true,
                description: "Website objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "deleteNote"
                        ]
                    }
                }
            },
            {
                displayName: "Note ID",
                name: "noteId",
                type: "string",
                default: "",
                required: true,
                description: "Manual note objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "deleteNote"
                        ]
                    }
                }
            },
            {
                displayName: "Website ID",
                name: "websiteId",
                type: "string",
                default: "",
                required: true,
                description: "Website objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "listNotes"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "listNotes"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Order",
                        name: "order",
                        type: "options",
                        default: "desc",
                        description: "Sort order",
                        options: [
                            {
                                name: "Asc",
                                value: "asc"
                            },
                            {
                                name: "Desc",
                                value: "desc"
                            }
                        ]
                    },
                    {
                        displayName: "Q",
                        name: "q",
                        type: "string",
                        default: "",
                        description: "Case-insensitive text search, up to 200 characters"
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    }
                ]
            },
            {
                displayName: "Website ID",
                name: "websiteId",
                type: "string",
                default: "",
                required: true,
                description: "Website objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "updateNote"
                        ]
                    }
                }
            },
            {
                displayName: "Note ID",
                name: "noteId",
                type: "string",
                default: "",
                required: true,
                description: "Manual note objectid",
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "updateNote"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "notes"
                        ],
                        operation: [
                            "updateNote"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Text",
                        name: "text",
                        type: "string",
                        default: ""
                    },
                    {
                        displayName: "Timestamp",
                        name: "timestamp",
                        type: "string",
                        default: "",
                        description: "ISO 8601 timestamp or yyyy-mm-dd in website timezone"
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "socialMentions"
                        ]
                    }
                },
                default: "listMentions",
                options: [
                    {
                        name: "List",
                        value: "listMentions",
                        action: "List social mentions",
                        description: "Search stored x and reddit mentions. this endpoint does not start a new search. social mentions."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "socialMentions"
                        ],
                        operation: [
                            "listMentions"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Order",
                        name: "order",
                        type: "options",
                        default: "desc",
                        description: "Sort order",
                        options: [
                            {
                                name: "Asc",
                                value: "asc"
                            },
                            {
                                name: "Desc",
                                value: "desc"
                            }
                        ]
                    },
                    {
                        displayName: "Platform",
                        name: "platform",
                        type: "options",
                        default: "x",
                        description: "Filter mentions by platform",
                        options: [
                            {
                                name: "Reddit",
                                value: "reddit"
                            },
                            {
                                name: "X",
                                value: "x"
                            }
                        ]
                    },
                    {
                        displayName: "Q",
                        name: "q",
                        type: "string",
                        default: "",
                        description: "Case-insensitive text search, up to 200 characters"
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Operation",
                name: "operation",
                type: "options",
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: [
                            "visitors"
                        ]
                    }
                },
                default: "getVisitor",
                options: [
                    {
                        name: "Get",
                        value: "getVisitor",
                        action: "Get visitor",
                        description: "Requires analytics:read for account tokens where applicable. visitors."
                    },
                    {
                        name: "List",
                        value: "listVisitors",
                        action: "List visitors",
                        description: "Search lightweight visitor rows; use get visitor to retrieve a visitor journey"
                    }
                ]
            },
            {
                displayName: "Datafast Visitor ID",
                name: "datafast_visitor_id",
                type: "string",
                default: "",
                required: true,
                description: "Datafast visitor UUID",
                displayOptions: {
                    show: {
                        resource: [
                            "visitors"
                        ],
                        operation: [
                            "getVisitor"
                        ]
                    }
                }
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "visitors"
                        ],
                        operation: [
                            "getVisitor"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            },
            {
                displayName: "Additional Fields",
                name: "additionalFields",
                type: "collection",
                placeholder: "Add Field",
                default: {},
                displayOptions: {
                    show: {
                        resource: [
                            "visitors"
                        ],
                        operation: [
                            "listVisitors"
                        ]
                    }
                },
                options: [
                    {
                        displayName: "Browser",
                        name: "browser",
                        type: "string",
                        default: "",
                        description: "Filter visitors by browser"
                    },
                    {
                        displayName: "Completed Goal",
                        name: "completedGoal",
                        type: "string",
                        default: "",
                        description: "Filter visitors who completed this goal"
                    },
                    {
                        displayName: "Country",
                        name: "country",
                        type: "string",
                        default: "",
                        description: "Filter visitors by country"
                    },
                    {
                        displayName: "Device",
                        name: "device",
                        type: "string",
                        default: "",
                        description: "Filter visitors by device"
                    },
                    {
                        displayName: "End At",
                        name: "endAt",
                        type: "string",
                        default: "",
                        description: "Inclusive end bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with startat."
                    },
                    {
                        displayName: "Is Customer",
                        name: "isCustomer",
                        type: "boolean",
                        default: false,
                        description: "Whether filter visitors by customer status"
                    },
                    {
                        displayName: "Limit",
                        name: "limit",
                        type: "number",
                        default: 50,
                        description: "Max number of results to return",
                        typeOptions: {
                            minValue: 1
                        }
                    },
                    {
                        displayName: "Offset",
                        name: "offset",
                        type: "number",
                        default: 0,
                        description: "Number of results to skip",
                        typeOptions: {
                            minValue: 0
                        }
                    },
                    {
                        displayName: "Start At",
                        name: "startAt",
                        type: "string",
                        default: "",
                        description: "Inclusive start bound, as yyyy-mm-dd or an ISO 8601 timestamp. supply with endat."
                    },
                    {
                        displayName: "Timezone",
                        name: "timezone",
                        type: "string",
                        default: "",
                        description: "Iana timezone. defaults to the website timezone.",
                        placeholder: "e.g. America/New_York"
                    },
                    {
                        displayName: "Utm Campaign",
                        name: "utm_campaign",
                        type: "string",
                        default: "",
                        description: "Filter visitors by utm campaign"
                    },
                    {
                        displayName: "Visited Page",
                        name: "visitedPage",
                        type: "string",
                        default: "",
                        description: "Filter visitors by exact page path"
                    },
                    {
                        displayName: "Visited Page Contains",
                        name: "visitedPageContains",
                        type: "string",
                        default: "",
                        description: "Filter visitors by a page path substring"
                    },
                    {
                        displayName: "Website ID",
                        name: "websiteId",
                        type: "string",
                        default: "",
                        description: "Website objectid. required with dft_ account tokens; inferred from df_ website keys."
                    }
                ]
            }
        ]
    };

  public async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const inputItems = this.getInputData();
    const output: INodeExecutionData[] = [];
    for (let itemIndex = 0; itemIndex < inputItems.length; itemIndex += 1) {
      const outputStart = output.length;
      let errorPlan: Record<string, { title: string; recovery?: string; parameter?: string }> = {};
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as string;
        const nodeVersion = this.getNode().typeVersion;
        let additionalFields: IDataObject = {};
        const nodeOptions = this.getNodeParameter('options', itemIndex, {}) as IDataObject;
        
        let retryContract: RetryContract = { mode: 'none', maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0 };
        let credentialApplications: CredentialApplication[] | undefined;
        let options: IHttpRequestOptions;
        let pagination: PaginationContract = { style: 'none', advancement: '', maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10 * 1024 * 1024, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        let responsePlan: { binary: boolean; full: boolean; envelopePath: string; itemPath: string; fields: string[]; simplified: string[] } = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        switch (operation) {
          case "getAccount": {
        
        
        const path = "/admin/account";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "updateAccount": {
        
        
        const path = "/admin/account";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string","required":true}, this.getNodeParameter("name", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "createAlert": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/admin/websites/{websiteId}/alerts";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        if (additionalFields["isEnabled"] !== undefined) setBodyField(body as IDataObject, {"name":"isEnabled","displayName":"Is Enabled","type":"boolean"}, additionalFields["isEnabled"], this, itemIndex);
    if (additionalFields["name"] !== undefined) setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string"}, additionalFields["name"], this, itemIndex);
    if (additionalFields["template"] !== undefined) setBodyField(body as IDataObject, {"name":"template","displayName":"Template","type":"object","representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"any"}}, additionalFields["template"], this, itemIndex);
    if (additionalFields["trigger"] !== undefined) setBodyField(body as IDataObject, {"name":"trigger","displayName":"Trigger","type":"object","representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"any"}}, additionalFields["trigger"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "deleteAlert": {
        
        
        let path = "/admin/websites/{websiteId}/alerts/{alertId}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
    path = path.split("{alertId}").join(encodeURIComponent(String(this.getNodeParameter("alertId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getAlertHistory": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/admin/websites/{websiteId}/alerts/history";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
    if (additionalFields["alertId"] !== undefined) qs["alertId"] = additionalFields["alertId"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "listAlerts": {
        
        
        let path = "/admin/websites/{websiteId}/alerts";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "updateAlert": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/admin/websites/{websiteId}/alerts/{alertId}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
    path = path.split("{alertId}").join(encodeURIComponent(String(this.getNodeParameter("alertId", itemIndex))));
        if (additionalFields["isEnabled"] !== undefined) setBodyField(body as IDataObject, {"name":"isEnabled","displayName":"Is Enabled","type":"boolean"}, additionalFields["isEnabled"], this, itemIndex);
    if (additionalFields["name"] !== undefined) setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string"}, additionalFields["name"], this, itemIndex);
    if (additionalFields["template"] !== undefined) setBodyField(body as IDataObject, {"name":"template","displayName":"Template","type":"object","representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"any"}}, additionalFields["template"], this, itemIndex);
    if (additionalFields["trigger"] !== undefined) setBodyField(body as IDataObject, {"name":"trigger","displayName":"Trigger","type":"object","representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"any"}}, additionalFields["trigger"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getAnalyticsMetadata": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/metadata";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["fields"] !== undefined) qs["fields"] = additionalFields["fields"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getAnalyticsOverview": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/overview";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["fields"] !== undefined) qs["fields"] = additionalFields["fields"];
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getAnalyticsTimeseries": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/timeseries";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    qs["fields"] = this.getNodeParameter("fields", itemIndex);
    qs["interval"] = this.getNodeParameter("interval", itemIndex);
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getRealtimeMap": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/realtime/map";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getRealtimeVisitors": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/realtime";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "createAccessToken": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/admin/access-tokens";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        if (additionalFields["name"] !== undefined) setBodyField(body as IDataObject, {"name":"name","displayName":"Name","description":"Dashboard label.","type":"string","nullable":true}, additionalFields["name"], this, itemIndex);
    if (additionalFields["permissions"] !== undefined) setBodyField(body as IDataObject, {"name":"permissions","displayName":"Permissions","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string","enum":["analytics:read","goals:read","goals:write","payments:read","payments:write","identify:write","websites:read","websites:write","settings:read","settings:write","api-keys:read","api-keys:write","funnels:read","funnels:write","alerts:read","alerts:write","team:read","team:write","notes:read","notes:write","*"]}}, additionalFields["permissions"], this, itemIndex);
    if (additionalFields["websiteIds"] !== undefined) setBodyField(body as IDataObject, {"name":"websiteIds","displayName":"Website Ids","description":"An empty array means all websites available to the caller.","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["websiteIds"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "createWebsiteApiKey": {
        
        
        let path = "/admin/websites/{websiteId}/apikeys";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string","required":true}, this.getNodeParameter("name", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "deleteAccessToken": {
        
        
        let path = "/admin/access-tokens/{tokenId}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{tokenId}").join(encodeURIComponent(String(this.getNodeParameter("tokenId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "deleteWebsiteApiKey": {
        
        
        let path = "/admin/websites/{websiteId}/apikeys/{apiKeyId}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
    path = path.split("{apiKeyId}").join(encodeURIComponent(String(this.getNodeParameter("apiKeyId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "listAccessTokens": {
        
        
        const path = "/admin/access-tokens";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "listWebsiteApiKeys": {
        
        
        let path = "/admin/websites/{websiteId}/apikeys";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "rollWebsiteApiKey": {
        
        
        let path = "/admin/websites/{websiteId}/apikeys/{apiKeyId}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
    path = path.split("{apiKeyId}").join(encodeURIComponent(String(this.getNodeParameter("apiKeyId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "createBotTrafficToken": {
        
        
        let path = "/admin/websites/{websiteId}/bot-traffic/token";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "deleteBotTrafficToken": {
        
        
        let path = "/admin/websites/{websiteId}/bot-traffic/token";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getBotTrafficPages": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/bot-traffic/pages";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["interval"] !== undefined) qs["interval"] = additionalFields["interval"];
    if (additionalFields["category"] !== undefined) qs["category"] = additionalFields["category"];
    if (additionalFields["verification"] !== undefined) qs["verification"] = additionalFields["verification"];
    if (additionalFields["company"] !== undefined) qs["company"] = additionalFields["company"];
    if (additionalFields["crawlerId"] !== undefined) qs["crawlerId"] = additionalFields["crawlerId"];
    if (additionalFields["pageSearch"] !== undefined) qs["pageSearch"] = additionalFields["pageSearch"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getBotTrafficSettings": {
        
        
        let path = "/admin/websites/{websiteId}/bot-traffic/settings";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getBotTrafficSummary": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/bot-traffic";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["interval"] !== undefined) qs["interval"] = additionalFields["interval"];
    if (additionalFields["category"] !== undefined) qs["category"] = additionalFields["category"];
    if (additionalFields["verification"] !== undefined) qs["verification"] = additionalFields["verification"];
    if (additionalFields["company"] !== undefined) qs["company"] = additionalFields["company"];
    if (additionalFields["crawlerId"] !== undefined) qs["crawlerId"] = additionalFields["crawlerId"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getBotTrafficTokenStatus": {
        
        
        let path = "/admin/websites/{websiteId}/bot-traffic/token";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getBotTrafficUsage": {
        
        
        const path = "/admin/bot-traffic/usage";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "rotateBotTrafficToken": {
        
        
        let path = "/admin/websites/{websiteId}/bot-traffic/token";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "updateBotTrafficSettings": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/admin/websites/{websiteId}/bot-traffic/settings";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        if (additionalFields["disableCompanies"] !== undefined) setBodyField(body as IDataObject, {"name":"disableCompanies","displayName":"Disable Companies","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["disableCompanies"], this, itemIndex);
    if (additionalFields["disableCrawlerIds"] !== undefined) setBodyField(body as IDataObject, {"name":"disableCrawlerIds","displayName":"Disable Crawler Ids","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["disableCrawlerIds"], this, itemIndex);
    if (additionalFields["enableCompanies"] !== undefined) setBodyField(body as IDataObject, {"name":"enableCompanies","displayName":"Enable Companies","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["enableCompanies"], this, itemIndex);
    if (additionalFields["enableCrawlerIds"] !== undefined) setBodyField(body as IDataObject, {"name":"enableCrawlerIds","displayName":"Enable Crawler Ids","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["enableCrawlerIds"], this, itemIndex);
    if (additionalFields["excludedCrawlerIds"] !== undefined) setBodyField(body as IDataObject, {"name":"excludedCrawlerIds","displayName":"Excluded Crawler Ids","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["excludedCrawlerIds"], this, itemIndex);
    if (additionalFields["groupBy"] !== undefined) setBodyField(body as IDataObject, {"name":"groupBy","displayName":"Group By","type":"string"}, additionalFields["groupBy"], this, itemIndex);
    if (additionalFields["hiddenCrawlers"] !== undefined) setBodyField(body as IDataObject, {"name":"hiddenCrawlers","displayName":"Hidden Crawlers","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["hiddenCrawlers"], this, itemIndex);
    if (additionalFields["hideDashboardCard"] !== undefined) setBodyField(body as IDataObject, {"name":"hideDashboardCard","displayName":"Hide Dashboard Card","type":"boolean"}, additionalFields["hideDashboardCard"], this, itemIndex);
    if (additionalFields["pageFilterIds"] !== undefined) setBodyField(body as IDataObject, {"name":"pageFilterIds","displayName":"Page Filter Ids","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["pageFilterIds"], this, itemIndex);
    if (additionalFields["requireAuthToken"] !== undefined) setBodyField(body as IDataObject, {"name":"requireAuthToken","displayName":"Require Auth Token","type":"boolean"}, additionalFields["requireAuthToken"], this, itemIndex);
    if (additionalFields["verifiedOnly"] !== undefined) setBodyField(body as IDataObject, {"name":"verifiedOnly","displayName":"Verified Only","type":"boolean"}, additionalFields["verifiedOnly"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getBrowserAnalytics": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/browsers";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["fields"] !== undefined) qs["fields"] = additionalFields["fields"];
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getCampaignAnalytics": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/campaigns";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["fields"] !== undefined) qs["fields"] = additionalFields["fields"];
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getCityAnalytics": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/cities";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["fields"] !== undefined) qs["fields"] = additionalFields["fields"];
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getCountryAnalytics": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/countries";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["fields"] !== undefined) qs["fields"] = additionalFields["fields"];
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getDeviceAnalytics": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/devices";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["fields"] !== undefined) qs["fields"] = additionalFields["fields"];
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getExitClickAnalytics": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/exit-clicks";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["fields"] !== undefined) qs["fields"] = additionalFields["fields"];
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getHostnameAnalytics": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/hostnames";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["fields"] !== undefined) qs["fields"] = additionalFields["fields"];
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getOperatingSystemAnalytics": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/operating-systems";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["fields"] !== undefined) qs["fields"] = additionalFields["fields"];
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getPageAnalytics": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/pages";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["fields"] !== undefined) qs["fields"] = additionalFields["fields"];
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getReferrerAnalytics": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/referrers";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["fields"] !== undefined) qs["fields"] = additionalFields["fields"];
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getRegionAnalytics": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/regions";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["fields"] !== undefined) qs["fields"] = additionalFields["fields"];
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "createFunnel": {
        
        
        let path = "/admin/websites/{websiteId}/funnels";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string","required":true}, this.getNodeParameter("name", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"steps","displayName":"Steps","type":"array","required":true,"representation":"raw","items":{"name":"item","displayName":"Item","type":"alternative","composition":"oneOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"name","displayName":"Name","type":"string","required":true},{"name":"type","displayName":"Type","type":"string","required":true},{"name":"url","displayName":"Url","type":"string","required":true}],"additionalValue":{"name":"value","displayName":"Value","type":"any"}},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"goalName","displayName":"Goal Name","type":"string","required":true},{"name":"name","displayName":"Name","type":"string","required":true},{"name":"type","displayName":"Type","type":"string","required":true}],"additionalValue":{"name":"value","displayName":"Value","type":"any"}}]}}, this.getNodeParameter("steps", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "deleteFunnel": {
        
        
        let path = "/admin/websites/{websiteId}/funnels/{funnelId}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
    path = path.split("{funnelId}").join(encodeURIComponent(String(this.getNodeParameter("funnelId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getFunnelAnalytics": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/analytics/funnels/{funnelId}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{funnelId}").join(encodeURIComponent(String(this.getNodeParameter("funnelId", itemIndex))));
    if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["timezoneQuery"] !== undefined) qs["timezone"] = additionalFields["timezoneQuery"];
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "listFunnels": {
        
        
        let path = "/admin/websites/{websiteId}/funnels";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "updateFunnel": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/admin/websites/{websiteId}/funnels/{funnelId}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
    path = path.split("{funnelId}").join(encodeURIComponent(String(this.getNodeParameter("funnelId", itemIndex))));
        if (additionalFields["name"] !== undefined) setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string"}, additionalFields["name"], this, itemIndex);
    if (additionalFields["steps"] !== undefined) setBodyField(body as IDataObject, {"name":"steps","displayName":"Steps","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"alternative","composition":"oneOf","representation":"raw","alternatives":[{"name":"alternative1","displayName":"Alternative1","type":"object","representation":"raw","fields":[{"name":"name","displayName":"Name","type":"string","required":true},{"name":"type","displayName":"Type","type":"string","required":true},{"name":"url","displayName":"Url","type":"string","required":true}],"additionalValue":{"name":"value","displayName":"Value","type":"any"}},{"name":"alternative2","displayName":"Alternative2","type":"object","representation":"raw","fields":[{"name":"goalName","displayName":"Goal Name","type":"string","required":true},{"name":"name","displayName":"Name","type":"string","required":true},{"name":"type","displayName":"Type","type":"string","required":true}],"additionalValue":{"name":"value","displayName":"Value","type":"any"}}]}}, additionalFields["steps"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "analyzeGoals": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/goals";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["fields"] !== undefined) qs["fields"] = additionalFields["fields"];
    if (additionalFields["filter_country"] !== undefined) qs["filter_country"] = additionalFields["filter_country"];
    if (additionalFields["filter_region"] !== undefined) qs["filter_region"] = additionalFields["filter_region"];
    if (additionalFields["filter_city"] !== undefined) qs["filter_city"] = additionalFields["filter_city"];
    if (additionalFields["filter_device"] !== undefined) qs["filter_device"] = additionalFields["filter_device"];
    if (additionalFields["filter_browser"] !== undefined) qs["filter_browser"] = additionalFields["filter_browser"];
    if (additionalFields["filter_os"] !== undefined) qs["filter_os"] = additionalFields["filter_os"];
    if (additionalFields["filter_page"] !== undefined) qs["filter_page"] = additionalFields["filter_page"];
    if (additionalFields["filter_entry_page"] !== undefined) qs["filter_entry_page"] = additionalFields["filter_entry_page"];
    if (additionalFields["filter_hostname"] !== undefined) qs["filter_hostname"] = additionalFields["filter_hostname"];
    if (additionalFields["filter_goal"] !== undefined) qs["filter_goal"] = additionalFields["filter_goal"];
    if (additionalFields["filter_visit_count"] !== undefined) qs["filter_visit_count"] = additionalFields["filter_visit_count"];
    if (additionalFields["filter_referrer"] !== undefined) qs["filter_referrer"] = additionalFields["filter_referrer"];
    if (additionalFields["filter_ref"] !== undefined) qs["filter_ref"] = additionalFields["filter_ref"];
    if (additionalFields["filter_source"] !== undefined) qs["filter_source"] = additionalFields["filter_source"];
    if (additionalFields["filter_via"] !== undefined) qs["filter_via"] = additionalFields["filter_via"];
    if (additionalFields["filter_utm_source"] !== undefined) qs["filter_utm_source"] = additionalFields["filter_utm_source"];
    if (additionalFields["filter_utm_medium"] !== undefined) qs["filter_utm_medium"] = additionalFields["filter_utm_medium"];
    if (additionalFields["filter_utm_campaign"] !== undefined) qs["filter_utm_campaign"] = additionalFields["filter_utm_campaign"];
    if (additionalFields["filter_utm_term"] !== undefined) qs["filter_utm_term"] = additionalFields["filter_utm_term"];
    if (additionalFields["filter_utm_content"] !== undefined) qs["filter_utm_content"] = additionalFields["filter_utm_content"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "createGoal": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/goals";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
        setBodyField(body as IDataObject, {"name":"datafast_visitor_id","displayName":"Datafast visitor id","type":"string","format":"uuid","required":true}, this.getNodeParameter("datafast_visitor_id", itemIndex), this, itemIndex);
    if (additionalFields["description"] !== undefined) setBodyField(body as IDataObject, {"name":"description","displayName":"Description","type":"string"}, additionalFields["description"], this, itemIndex);
    if (additionalFields["metadata"] !== undefined) setBodyField(body as IDataObject, {"name":"metadata","displayName":"Metadata","type":"object","representation":"raw","additionalValue":{"name":"value","displayName":"Value","type":"string"}}, additionalFields["metadata"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"name","displayName":"Name","description":"Names are normalized to lowercase; identify is reserved.","type":"string","required":true}, this.getNodeParameter("name", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "deleteGoalCustomization": {
        
        
        let path = "/admin/websites/{websiteId}/goals/customizations";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
    qs["goalName"] = this.getNodeParameter("goalName", itemIndex);
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "deleteGoals": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/goals";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["datafast_visitor_id"] !== undefined) qs["datafast_visitor_id"] = additionalFields["datafast_visitor_id"];
    if (additionalFields["goalName"] !== undefined) qs["goalName"] = additionalFields["goalName"];
    if (additionalFields["start"] !== undefined) qs["start"] = additionalFields["start"];
    if (additionalFields["end"] !== undefined) qs["end"] = additionalFields["end"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getGoalProperties": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/analytics/goals/properties";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    qs["eventName"] = this.getNodeParameter("eventName", itemIndex);
    if (additionalFields["propertyName"] !== undefined) qs["propertyName"] = additionalFields["propertyName"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "listGoalCustomizations": {
        
        
        let path = "/admin/websites/{websiteId}/goals/customizations";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "listTrackedGoals": {
        
        
        let path = "/admin/websites/{websiteId}/goals";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "updateGoalCustomization": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/admin/websites/{websiteId}/goals/customizations";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        if (additionalFields["color"] !== undefined) setBodyField(body as IDataObject, {"name":"color","displayName":"Color","type":"string"}, additionalFields["color"], this, itemIndex);
    if (additionalFields["description"] !== undefined) setBodyField(body as IDataObject, {"name":"description","displayName":"Description","type":"string"}, additionalFields["description"], this, itemIndex);
    if (additionalFields["goalName"] !== undefined) setBodyField(body as IDataObject, {"name":"goalName","displayName":"Goal Name","type":"string"}, additionalFields["goalName"], this, itemIndex);
    if (additionalFields["name"] !== undefined) setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string"}, additionalFields["name"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "identifyVisitor": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/identify";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
        setBodyField(body as IDataObject, {"name":"datafast_visitor_id","displayName":"Datafast visitor id","type":"string","format":"uuid","required":true}, this.getNodeParameter("datafast_visitor_id", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"user_id","displayName":"User id","type":"string","required":true}, this.getNodeParameter("user_id", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "connectLemonsqueezy": {
        
        
        let path = "/admin/websites/{websiteId}/integrations/lemonsqueezy";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        setBodyField(body as IDataObject, {"name":"lemonsqueezyApiKey","displayName":"Lemonsqueezy Api Key","type":"string","required":true}, this.getNodeParameter("lemonsqueezyApiKey", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"lemonsqueezyStoreId","displayName":"Lemonsqueezy Store Id","type":"string","required":true}, this.getNodeParameter("lemonsqueezyStoreId", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "connectPaddle": {
        
        
        let path = "/admin/websites/{websiteId}/integrations/paddle";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        setBodyField(body as IDataObject, {"name":"paddleApiKey","displayName":"Paddle Api Key","type":"string","required":true}, this.getNodeParameter("paddleApiKey", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "connectPolar": {
        
        
        let path = "/admin/websites/{websiteId}/integrations/polar";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        setBodyField(body as IDataObject, {"name":"polarAccessToken","displayName":"Polar Access Token","type":"string","required":true}, this.getNodeParameter("polarAccessToken", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"polarOrgId","displayName":"Polar Org Id","type":"string","required":true}, this.getNodeParameter("polarOrgId", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "connectStripe": {
        
        
        let path = "/admin/websites/{websiteId}/integrations/stripe";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        setBodyField(body as IDataObject, {"name":"stripeRak","displayName":"Stripe Rak","type":"string","required":true}, this.getNodeParameter("stripeRak", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "disconnectLemonsqueezy": {
        
        
        let path = "/admin/websites/{websiteId}/integrations/lemonsqueezy";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "disconnectPaddle": {
        
        
        let path = "/admin/websites/{websiteId}/integrations/paddle";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "disconnectPolar": {
        
        
        let path = "/admin/websites/{websiteId}/integrations/polar";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "disconnectShopify": {
        
        
        let path = "/admin/websites/{websiteId}/integrations/shopify";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "disconnectStripe": {
        
        
        let path = "/admin/websites/{websiteId}/integrations/stripe";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "disconnectWooCommerce": {
        
        
        let path = "/admin/websites/{websiteId}/integrations/woocommerce";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getIntegrations": {
        
        
        let path = "/admin/websites/{websiteId}/integrations";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "resyncPaddlePayments": {
        
        
        let path = "/admin/websites/{websiteId}/integrations/paddle";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "PATCH" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "createNote": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/admin/websites/{websiteId}/notes";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        if (additionalFields["idempotencyKey"] !== undefined) setBodyField(body as IDataObject, {"name":"idempotencyKey","displayName":"Idempotency Key","type":"string","pattern":"^[A-Za-z0-9._:-]+$"}, additionalFields["idempotencyKey"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"text","displayName":"Text","type":"string","required":true}, this.getNodeParameter("text", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"timestamp","displayName":"Timestamp","description":"ISO 8601 timestamp or YYYY-MM-DD in website timezone.","type":"string","required":true}, this.getNodeParameter("timestamp", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "deleteNote": {
        
        
        let path = "/admin/websites/{websiteId}/notes/{noteId}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
    path = path.split("{noteId}").join(encodeURIComponent(String(this.getNodeParameter("noteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "listNotes": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/admin/websites/{websiteId}/notes";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["q"] !== undefined) qs["q"] = additionalFields["q"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["order"] !== undefined) qs["order"] = additionalFields["order"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "updateNote": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/admin/websites/{websiteId}/notes/{noteId}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
    path = path.split("{noteId}").join(encodeURIComponent(String(this.getNodeParameter("noteId", itemIndex))));
        if (additionalFields["text"] !== undefined) setBodyField(body as IDataObject, {"name":"text","displayName":"Text","type":"string"}, additionalFields["text"], this, itemIndex);
    if (additionalFields["timestamp"] !== undefined) setBodyField(body as IDataObject, {"name":"timestamp","displayName":"Timestamp","description":"ISO 8601 timestamp or YYYY-MM-DD in website timezone.","type":"string"}, additionalFields["timestamp"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "createPayment": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/payments";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
        setBodyField(body as IDataObject, {"name":"amount","displayName":"Amount","type":"number","required":true,"minValue":0}, this.getNodeParameter("amount", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"currency","displayName":"Currency","type":"string","required":true}, this.getNodeParameter("currency", itemIndex), this, itemIndex);
    if (additionalFields["customer_email"] !== undefined) setBodyField(body as IDataObject, {"name":"customer_email","displayName":"Customer email","type":"string","format":"email"}, additionalFields["customer_email"], this, itemIndex);
    if (additionalFields["customer_id"] !== undefined) setBodyField(body as IDataObject, {"name":"customer_id","displayName":"Customer id","type":"string"}, additionalFields["customer_id"], this, itemIndex);
    if (additionalFields["customer_name"] !== undefined) setBodyField(body as IDataObject, {"name":"customer_name","displayName":"Customer name","type":"string"}, additionalFields["customer_name"], this, itemIndex);
    if (additionalFields["datafast_visitor_id"] !== undefined) setBodyField(body as IDataObject, {"name":"datafast_visitor_id","displayName":"Datafast visitor id","type":"string"}, additionalFields["datafast_visitor_id"], this, itemIndex);
    if (additionalFields["email"] !== undefined) setBodyField(body as IDataObject, {"name":"email","displayName":"Email","type":"string","format":"email"}, additionalFields["email"], this, itemIndex);
    if (additionalFields["is_free_trial"] !== undefined) setBodyField(body as IDataObject, {"name":"is_free_trial","displayName":"Is free trial","type":"boolean"}, additionalFields["is_free_trial"], this, itemIndex);
    if (additionalFields["name"] !== undefined) setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string"}, additionalFields["name"], this, itemIndex);
    if (additionalFields["refunded"] !== undefined) setBodyField(body as IDataObject, {"name":"refunded","displayName":"Refunded","type":"boolean"}, additionalFields["refunded"], this, itemIndex);
    if (additionalFields["renewal"] !== undefined) setBodyField(body as IDataObject, {"name":"renewal","displayName":"Renewal","type":"boolean"}, additionalFields["renewal"], this, itemIndex);
    if (additionalFields["timestamp"] !== undefined) setBodyField(body as IDataObject, {"name":"timestamp","displayName":"Timestamp","type":"string","format":"date-time"}, additionalFields["timestamp"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"transaction_id","displayName":"Transaction id","type":"string","required":true}, this.getNodeParameter("transaction_id", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["message","transaction_id"], simplified: ["message","transaction_id"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "deletePayments": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/payments";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["transaction_id"] !== undefined) qs["transaction_id"] = additionalFields["transaction_id"];
    if (additionalFields["datafast_visitor_id"] !== undefined) qs["datafast_visitor_id"] = additionalFields["datafast_visitor_id"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["start"] !== undefined) qs["start"] = additionalFields["start"];
    if (additionalFields["end"] !== undefined) qs["end"] = additionalFields["end"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "listMentions": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/mentions";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["q"] !== undefined) qs["q"] = additionalFields["q"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["order"] !== undefined) qs["order"] = additionalFields["order"];
    if (additionalFields["platform"] !== undefined) qs["platform"] = additionalFields["platform"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "inviteTeamMember": {
        
        
        let path = "/admin/websites/{websiteId}/team";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        setBodyField(body as IDataObject, {"name":"email","displayName":"Email","type":"string","format":"email","required":true}, this.getNodeParameter("email", itemIndex), this, itemIndex);
    setBodyField(body as IDataObject, {"name":"role","displayName":"Role","type":"string","required":true,"enum":["viewer","member"]}, this.getNodeParameter("role", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "listTeamMembers": {
        
        
        let path = "/admin/websites/{websiteId}/team";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "removeTeamMember": {
        
        
        let path = "/admin/websites/{websiteId}/team";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        setBodyField(body as IDataObject, {"name":"userId","displayName":"User Id","type":"string","required":true}, this.getNodeParameter("userId", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getVisitor": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/visitors/{datafast_visitor_id}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{datafast_visitor_id}").join(encodeURIComponent(String(this.getNodeParameter("datafast_visitor_id", itemIndex))));
    if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "listVisitors": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/visitors";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        if (additionalFields["websiteId"] !== undefined) qs["websiteId"] = additionalFields["websiteId"];
    if (additionalFields["startAt"] !== undefined) qs["startAt"] = additionalFields["startAt"];
    if (additionalFields["endAt"] !== undefined) qs["endAt"] = additionalFields["endAt"];
    if (additionalFields["timezone"] !== undefined) qs["timezone"] = additionalFields["timezone"];
    if (additionalFields["limit"] !== undefined) qs["limit"] = additionalFields["limit"];
    if (additionalFields["offset"] !== undefined) qs["offset"] = additionalFields["offset"];
    if (additionalFields["visitedPage"] !== undefined) qs["visitedPage"] = additionalFields["visitedPage"];
    if (additionalFields["visitedPageContains"] !== undefined) qs["visitedPageContains"] = additionalFields["visitedPageContains"];
    if (additionalFields["completedGoal"] !== undefined) qs["completedGoal"] = additionalFields["completedGoal"];
    if (additionalFields["country"] !== undefined) qs["country"] = additionalFields["country"];
    if (additionalFields["device"] !== undefined) qs["device"] = additionalFields["device"];
    if (additionalFields["browser"] !== undefined) qs["browser"] = additionalFields["browser"];
    if (additionalFields["utm_campaign"] !== undefined) qs["utm_campaign"] = additionalFields["utm_campaign"];
    if (additionalFields["isCustomer"] !== undefined) qs["isCustomer"] = additionalFields["isCustomer"];
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "createWebsite": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        const path = "/admin/websites";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        setBodyField(body as IDataObject, {"name":"domain","displayName":"Domain","description":"Tracked domain without a URL scheme.","type":"string","required":true}, this.getNodeParameter("domain", itemIndex), this, itemIndex);
    if (additionalFields["name"] !== undefined) setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string"}, additionalFields["name"], this, itemIndex);
    setBodyField(body as IDataObject, {"name":"timezone","displayName":"Timezone","description":"IANA timezone.","type":"string","required":true}, this.getNodeParameter("timezone", itemIndex), this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "POST" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "deleteWebsite": {
        
        
        let path = "/admin/websites/{websiteId}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "DELETE" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: [], simplified: [] };
        errorPlan = {"403":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."},"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "getWebsite": {
        
        
        let path = "/admin/websites/{websiteId}";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "listWebsites": {
        
        
        const path = "/admin/websites";
        const qs: IDataObject = {};
        
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        
        
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "GET" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
    case "updateWebsite": {
        
        additionalFields = this.getNodeParameter('additionalFields', itemIndex, {}) as IDataObject;
        let path = "/admin/websites/{websiteId}";
        const qs: IDataObject = {};
        const headers: IDataObject = {};
        const body: IDataObject | IDataObject[] | string | number | boolean | null = {};
        path = path.split("{websiteId}").join(encodeURIComponent(String(this.getNodeParameter("websiteId", itemIndex))));
        if (additionalFields["allowedHostnames"] !== undefined) setBodyField(body as IDataObject, {"name":"allowedHostnames","displayName":"Allowed Hostnames","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["allowedHostnames"], this, itemIndex);
    if (additionalFields["currency"] !== undefined) setBodyField(body as IDataObject, {"name":"currency","displayName":"Currency","type":"string"}, additionalFields["currency"], this, itemIndex);
    if (additionalFields["domain"] !== undefined) setBodyField(body as IDataObject, {"name":"domain","displayName":"Domain","type":"string"}, additionalFields["domain"], this, itemIndex);
    if (additionalFields["excludedCountries"] !== undefined) setBodyField(body as IDataObject, {"name":"excludedCountries","displayName":"Excluded Countries","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["excludedCountries"], this, itemIndex);
    if (additionalFields["excludedHostnames"] !== undefined) setBodyField(body as IDataObject, {"name":"excludedHostnames","displayName":"Excluded Hostnames","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["excludedHostnames"], this, itemIndex);
    if (additionalFields["excludedIps"] !== undefined) setBodyField(body as IDataObject, {"name":"excludedIps","displayName":"Excluded Ips","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["excludedIps"], this, itemIndex);
    if (additionalFields["excludedPaths"] !== undefined) setBodyField(body as IDataObject, {"name":"excludedPaths","displayName":"Excluded Paths","type":"array","representation":"raw","items":{"name":"item","displayName":"Item","type":"string"}}, additionalFields["excludedPaths"], this, itemIndex);
    if (additionalFields["includeRenewalRevenue"] !== undefined) setBodyField(body as IDataObject, {"name":"includeRenewalRevenue","displayName":"Include Renewal Revenue","type":"boolean"}, additionalFields["includeRenewalRevenue"], this, itemIndex);
    if (additionalFields["isCookieless"] !== undefined) setBodyField(body as IDataObject, {"name":"isCookieless","displayName":"Is Cookieless","type":"boolean"}, additionalFields["isCookieless"], this, itemIndex);
    if (additionalFields["kpi"] !== undefined) setBodyField(body as IDataObject, {"name":"kpi","displayName":"Kpi","type":"string","nullable":true}, additionalFields["kpi"], this, itemIndex);
    if (additionalFields["kpiColorScheme"] !== undefined) setBodyField(body as IDataObject, {"name":"kpiColorScheme","displayName":"Kpi Color Scheme","type":"string"}, additionalFields["kpiColorScheme"], this, itemIndex);
    if (additionalFields["name"] !== undefined) setBodyField(body as IDataObject, {"name":"name","displayName":"Name","type":"string","nullable":true}, additionalFields["name"], this, itemIndex);
    if (additionalFields["revenueMetric"] !== undefined) setBodyField(body as IDataObject, {"name":"revenueMetric","displayName":"Revenue Metric","type":"string"}, additionalFields["revenueMetric"], this, itemIndex);
    if (additionalFields["timezone"] !== undefined) setBodyField(body as IDataObject, {"name":"timezone","displayName":"Timezone","type":"string"}, additionalFields["timezone"], this, itemIndex);
        
        const serverBaseUrl = { url: "https://datafa.st/api/v1", blockRedirects: false };
        options = { method: "PUT" as unknown as IHttpRequestOptions["method"], url: serverBaseUrl.url + path, qs, headers: { ...headers, ...{ 'Content-Type': "application/json" } }, body: body, json: true, arrayFormat: "indices", ...(serverBaseUrl.blockRedirects ? { maxRedirects: 0 } : {}) };
        credentialApplications = ([{"credentialType":"datafastApi","type":"bearer"}]) as CredentialApplication[];
        retryContract = { mode: "none", retryConnectionFailures: false, retryTimeouts: false, retryRateLimits: false, retryServerErrors: false, maxAttempts: 1, maxElapsedMs: 30000, baseBackoffMs: 500, maxBackoffMs: 5000, jitterRatio: 0.2, idempotency: undefined };
        pagination = { style: "none", page: "", limit: "", cursor: "", responseCursor: "", hasMore: "", itemPath: "", advancement: "", maxPages: 1, maxItems: Number.POSITIVE_INFINITY, maxElapsedMs: 30000, maxMemoryBytes: 10485760, repeatedCursorLimit: 1, repeatedPageLimit: 1, pageSize: 100 };
        responsePlan = { binary: false, full: false, envelopePath: "", itemPath: "", fields: ["data","meta","pagination","status"], simplified: ["data","meta","pagination","status"] };
        errorPlan = {"default":{"title":"API error. Common status codes include 400, 401, 403, 404, 409, 429, 500, and 504."}};
        break;
      }
          default: throw new NodeOperationError(this.getNode(), `Unsupported operation ${operation} for node version ${nodeVersion}`, { itemIndex });
        }
        const returnAll = pagination.style !== 'none' ? Boolean(nodeOptions.returnAll ?? false) : false;
    const resultLimit = pagination.style !== 'none' && !returnAll ? Number(nodeOptions.resultLimit ?? 50) : Math.min(pagination.maxItems, Number.POSITIVE_INFINITY);
    const pageStartTime = Date.now();
    const seenCursors = new Map<string, number>(); const seenPages = new Map<string, number>();
    let page = 1; let offset = 0; let cursor: unknown; let pagesFetched = 0; let estimatedBytes = 0; let finished = false;
    while (!finished && output.length - outputStart < resultLimit && pagesFetched < pagination.maxPages) {
      if (Date.now() - pageStartTime > pagination.maxElapsedMs) throw new NodeOperationError(this.getNode(), 'Pagination elapsed-time budget was exceeded', { itemIndex });
      const qs = options.qs as IDataObject;
      // Only the paginator's own page size is written here. It used to overwrite a
      // limit parameter the operation itself declared and the user had just set.
      if (pagination.limit && (pagesFetched > 0 || qs[pagination.limit] === undefined)) qs[pagination.limit] = Math.min(pagination.pageSize, resultLimit - (output.length - outputStart));
      if (pagination.style === 'offset' && pagination.page) qs[pagination.page] = offset;
      if (pagination.style === 'pageNumber' && pagination.page) qs[pagination.page] = page;
      if (pagination.style === 'cursor' && pagination.cursor && cursor) qs[pagination.cursor] = cursor as string;
      const response = await requestWithRetry(this as never, options, credentialApplications, retryContract, itemIndex);
      pagesFetched += 1;
      const pageFingerprint = JSON.stringify(response);
      const pageRepeats = (seenPages.get(pageFingerprint) ?? 0) + 1;
      seenPages.set(pageFingerprint, pageRepeats);
      if (pageRepeats > pagination.repeatedPageLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-page budget was exceeded', { itemIndex });
      estimatedBytes += pageFingerprint.length;
      if (estimatedBytes > pagination.maxMemoryBytes) throw new NodeOperationError(this.getNode(), 'Pagination memory budget was exceeded', { itemIndex });
      if (responsePlan.binary) {
        const binaryPayload = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
        const responseHeaders = (responsePlan.full ? ((response as IDataObject).headers as IDataObject | undefined) : undefined) ?? {};
        const contentType = String(responseHeaders['content-type'] ?? '').split(';')[0].trim() || 'application/octet-stream';
        // prepareBinaryData is what fills in fileName, fileSize and fileExtension.
        // Hand-building the binary entry produced items that downstream nodes could
        // not name or type, and discarded the response's own content type.
        const binaryData = await this.helpers.prepareBinaryData(Buffer.from(binaryPayload as ArrayBuffer), undefined, contentType);
        output.push({ json: {}, binary: { data: binaryData }, pairedItem: { item: itemIndex } });
        finished = true;
        continue;
      }
      const normalizedResponse = responsePlan.full ? ((response as IDataObject).body ?? response) : response;
      const envelopeValue = valueAtPath(normalizedResponse, responsePlan.envelopePath);
      if (responsePlan.envelopePath && envelopeValue === undefined) throw new NodeOperationError(this.getNode(), `Response envelope path "${responsePlan.envelopePath}" was not found`, { itemIndex });
      const envelope = (envelopeValue ?? normalizedResponse) as IDataObject;
      const itemPath = pagination.itemPath || responsePlan.itemPath;
      const extractedItems = valueAtPath(envelope, itemPath);
      if (itemPath && extractedItems === undefined) throw new NodeOperationError(this.getNode(), `Response item path "${itemPath}" was not found`, { itemIndex });
      // A DELETE used to be reported as a fixed { deleted: true } with its body
      // thrown away, which lost the deleted representation and the job handle that
      // asynchronous deletes return. The body is used when there is one.
      const deletedFallback = options.method === 'DELETE' && (normalizedResponse === undefined || normalizedResponse === null || normalizedResponse === '' ||
        (typeof normalizedResponse === 'object' && !Array.isArray(normalizedResponse) && Object.keys(normalizedResponse as IDataObject).length === 0));
      const values = deletedFallback
        ? [{ deleted: true }]
        : Array.isArray(extractedItems) ? extractedItems : Array.isArray(normalizedResponse) ? normalizedResponse : [extractedItems ?? envelope];
      const outputMode = responsePlan.fields.length > 10 ? this.getNodeParameter('outputMode', itemIndex, 'simplified') as string : 'raw';
      const selectedFields = outputMode === 'selected' ? this.getNodeParameter('selectedFields', itemIndex, []) as string[] : [];
      for (const value of values) {
        if (output.length - outputStart >= resultLimit) break;
        const fields = outputMode === 'simplified' ? responsePlan.simplified : outputMode === 'selected' ? selectedFields : [];
        output.push({ json: selectResponseFields(value as IDataObject, fields), pairedItem: { item: itemIndex } });
      }
      if (!returnAll || pagination.style === 'none' || values.length === 0) { finished = true; continue; }
      if (pagination.hasMore && envelope[pagination.hasMore] === false) { finished = true; continue; }
      if (pagination.style === 'cursor') {
        cursor = pagination.responseCursor ? valueAtPath(envelope, pagination.responseCursor) : undefined;
        finished = !cursor;
        if (cursor) {
          const key = String(cursor);
          const repeats = (seenCursors.get(key) ?? 0) + 1;
          seenCursors.set(key, repeats);
          if (repeats > pagination.repeatedCursorLimit) throw new NodeOperationError(this.getNode(), 'Pagination repeated-cursor budget was exceeded', { itemIndex });
        }
      }
      if (pagination.advancement === 'offsetByItems') offset += values.length;
      if (pagination.advancement === 'incrementPage') page += 1;
    }
      } catch (error) {
        if (this.continueOnFail()) {
          output.push({ json: { error: (error as Error).message }, pairedItem: { item: itemIndex } });
          continue;
        }
        if (error instanceof NodeApiError) {
          const status = String((error as unknown as { httpCode?: string; cause?: { statusCode?: number } }).httpCode ?? (error as unknown as { cause?: { statusCode?: number } }).cause?.statusCode ?? 'default');
          const planned = errorPlan[status] ?? errorPlan.default;
          if (planned) {
            const parameterHelp = planned.parameter ? `Check the '${planned.parameter}' parameter.` : undefined;
            const description = [planned.recovery, parameterHelp].filter(Boolean).join(' ');
            throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex, message: planned.title, description });
          }
        }
        if (error instanceof NodeApiError) throw new NodeApiError(this.getNode(), error as unknown as JsonObject, { itemIndex });
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex });
      }
    }
    return [output];
  }
}
