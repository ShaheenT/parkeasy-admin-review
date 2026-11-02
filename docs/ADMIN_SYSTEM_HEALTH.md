# Admin System Health & Monitoring

## Scope
The System Health page is available at `/system-health` to users with the `admin` role only. Support-role users are redirected to the dashboard and do not see the navigation entry.

## Current telemetry scope
This first implementation is deliberately browser-local:
- Web Vitals: LCP, FCP, CLS and navigation TTFB when exposed by the browser.
- Runtime telemetry: uncaught browser errors, unhandled promise rejections and failed script/image/stylesheet loads observed during the current page session.
- Assets & Network: Resource Timing entries, average duration and resources taking longer than one second.
- Browser resources: animation-frame sampling and JavaScript heap size only where the browser exposes it.

Values that the browser does not expose are displayed as unavailable. The interface explicitly states that these are measurements from the current administrator's browser session, not aggregated production telemetry or platform-wide health.

## Production safety
Load/resilience execution is intentionally disabled. No stress test is run against production. Any future load test must target an isolated staging environment with synthetic accounts, bounded request rate and duration, a stop control and an audit record.

## Not included yet
This page does not ingest server logs, API failures, Supabase events, PayFast/payment-provider events, or telemetry from other users. It does not persist or transmit browser events. A future central telemetry pipeline requires a separately reviewed backend design, access policy, retention policy and privacy/security review.
