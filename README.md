# DataFast n8n community node

DataFast helps businesses track website visits, conversions, and revenue.

Generated from OpenAPI 1.0.0 with template 1.1.0. Generated files are platform-managed and will be overwritten during regeneration.

## Authentication

Configure the generated bearer token credential in n8n before using the node.

## Supported operations

- `GET /admin/account` - Get account profile
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /admin/account` - Update account profile
  - Retry Contract: none
  - Pagination Contract: none
- `POST /admin/websites/{websiteId}/alerts` - Create alert
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/websites/{websiteId}/alerts/{alertId}` - Delete alert
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/websites/{websiteId}/alerts/history` - Get alert history
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/websites/{websiteId}/alerts` - List alerts
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /admin/websites/{websiteId}/alerts/{alertId}` - Update alert
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/metadata` - Get website metadata
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/overview` - Get aggregate analytics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/timeseries` - Get time-series analytics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/realtime/map` - Get realtime map
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/realtime` - Get realtime visitors
  - Retry Contract: none
  - Pagination Contract: none
- `POST /admin/access-tokens` - Create account token
  - Retry Contract: none
  - Pagination Contract: none
- `POST /admin/websites/{websiteId}/apikeys` - Create website API key
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/access-tokens/{tokenId}` - Revoke account token
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/websites/{websiteId}/apikeys/{apiKeyId}` - Revoke website API key
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/access-tokens` - List account tokens
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/websites/{websiteId}/apikeys` - List website API keys
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /admin/websites/{websiteId}/apikeys/{apiKeyId}` - Roll website API key
  - Retry Contract: none
  - Pagination Contract: none
- `POST /admin/websites/{websiteId}/bot-traffic/token` - Create Bot traffic request-auth token
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/websites/{websiteId}/bot-traffic/token` - Delete Bot traffic request-auth token
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/bot-traffic/pages` - Get requested pages
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/websites/{websiteId}/bot-traffic/settings` - Get Bot traffic settings
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/bot-traffic` - Get Bot traffic summary
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/websites/{websiteId}/bot-traffic/token` - Get Bot traffic token status
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/bot-traffic/usage` - Get Bot traffic account usage
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /admin/websites/{websiteId}/bot-traffic/token` - Rotate Bot traffic request-auth token
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /admin/websites/{websiteId}/bot-traffic/settings` - Update Bot traffic settings
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/browsers` - Get browser analytics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/campaigns` - Get campaign analytics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/cities` - Get city analytics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/countries` - Get country analytics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/devices` - Get device analytics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/exit-clicks` - Get exit-click analytics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/hostnames` - Get hostname analytics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/operating-systems` - Get operating-system analytics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/pages` - Get page analytics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/referrers` - Get referrer analytics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/regions` - Get region analytics
  - Retry Contract: none
  - Pagination Contract: none
- `POST /admin/websites/{websiteId}/funnels` - Create funnel
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/websites/{websiteId}/funnels/{funnelId}` - Delete funnel
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/funnels/{funnelId}` - Get funnel analytics
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/websites/{websiteId}/funnels` - List funnels
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /admin/websites/{websiteId}/funnels/{funnelId}` - Update funnel
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/goals` - Analyze custom goals
  - Retry Contract: none
  - Pagination Contract: none
- `POST /goals` - Create a custom goal event
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/websites/{websiteId}/goals/customizations` - Reset goal customization
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /goals` - Delete custom goal events
  - Retry Contract: none
  - Pagination Contract: none
- `GET /analytics/goals/properties` - Get custom goal properties
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/websites/{websiteId}/goals/customizations` - List goal customizations
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/websites/{websiteId}/goals` - List tracked goals
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /admin/websites/{websiteId}/goals/customizations` - Update goal customization
  - Retry Contract: none
  - Pagination Contract: none
- `POST /identify` - Identify a visitor
  - Retry Contract: none
  - Pagination Contract: none
- `POST /admin/websites/{websiteId}/integrations/lemonsqueezy` - Connect Lemonsqueezy
  - Retry Contract: none
  - Pagination Contract: none
- `POST /admin/websites/{websiteId}/integrations/paddle` - Connect Paddle
  - Retry Contract: none
  - Pagination Contract: none
- `POST /admin/websites/{websiteId}/integrations/polar` - Connect Polar
  - Retry Contract: none
  - Pagination Contract: none
- `POST /admin/websites/{websiteId}/integrations/stripe` - Connect Stripe
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/websites/{websiteId}/integrations/lemonsqueezy` - Disconnect Lemonsqueezy
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/websites/{websiteId}/integrations/paddle` - Disconnect Paddle
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/websites/{websiteId}/integrations/polar` - Disconnect Polar
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/websites/{websiteId}/integrations/shopify` - Disconnect Shopify
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/websites/{websiteId}/integrations/stripe` - Disconnect Stripe
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/websites/{websiteId}/integrations/woocommerce` - Disconnect WooCommerce
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/websites/{websiteId}/integrations` - Get integration status
  - Retry Contract: none
  - Pagination Contract: none
- `PATCH /admin/websites/{websiteId}/integrations/paddle` - Queue Paddle payment resync
  - Retry Contract: none
  - Pagination Contract: none
- `POST /admin/websites/{websiteId}/notes` - Create manual note
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/websites/{websiteId}/notes/{noteId}` - Delete manual note
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/websites/{websiteId}/notes` - List manual notes
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /admin/websites/{websiteId}/notes/{noteId}` - Update manual note
  - Retry Contract: none
  - Pagination Contract: none
- `POST /payments` - Create a payment event
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /payments` - Delete payment events
  - Retry Contract: none
  - Pagination Contract: none
- `GET /mentions` - List social mentions
  - Retry Contract: none
  - Pagination Contract: none
- `POST /admin/websites/{websiteId}/team` - Invite team member
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/websites/{websiteId}/team` - List team members
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/websites/{websiteId}/team` - Remove team member
  - Retry Contract: none
  - Pagination Contract: none
- `GET /visitors/{datafast_visitor_id}` - Get visitor
  - Retry Contract: none
  - Pagination Contract: none
- `GET /visitors` - List visitors
  - Retry Contract: none
  - Pagination Contract: none
- `POST /admin/websites` - Create website
  - Retry Contract: none
  - Pagination Contract: none
- `DELETE /admin/websites/{websiteId}` - Delete website
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/websites/{websiteId}` - Get website settings
  - Retry Contract: none
  - Pagination Contract: none
- `GET /admin/websites` - List websites
  - Retry Contract: none
  - Pagination Contract: none
- `PUT /admin/websites/{websiteId}` - Update website settings
  - Retry Contract: none
  - Pagination Contract: none

## Usage

1. Install this community-node package in n8n.
2. Add the **DataFast** node to a workflow.
3. Select a resource and operation, configure its parameters, and execute the workflow.

## Example workflow

Connect **Manual Trigger** -> **DataFast** -> a destination node, select an operation, then run the workflow and inspect the returned items.

## Development

```sh
npm install
npm run build
npm run lint
npm run dev
```

`npm run dev` starts a local n8n development instance. Find the integration by its **DataFast** display name.
