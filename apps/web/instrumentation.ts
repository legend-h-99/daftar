import { SeverityNumber } from "@opentelemetry/api-logs";
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs";

const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const missingPostHogVariable = !posthogKey
  ? "NEXT_PUBLIC_POSTHOG_KEY"
  : !posthogHost
    ? "NEXT_PUBLIC_POSTHOG_HOST"
    : null;

if (missingPostHogVariable && process.env.NODE_ENV !== "production") {
  console.warn(
    `${missingPostHogVariable} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${missingPostHogVariable} is configured`,
  );
}

const posthogLoggerProvider = posthogKey && posthogHost
  ? new LoggerProvider({
      resource: resourceFromAttributes({
        "service.name": "daftar-web",
        "deployment.environment": process.env.NODE_ENV ?? "development",
      }),
    })
  : null;

if (posthogLoggerProvider && posthogKey && posthogHost) {
  posthogLoggerProvider.addLogRecordProcessor(
    new BatchLogRecordProcessor(
      new OTLPLogExporter({
        url: `${posthogHost.replace(/\/$/, "")}/i/v1/logs`,
        headers: {
          Authorization: `Bearer ${posthogKey}`,
          "Content-Type": "application/json",
        },
      }),
    ),
  );
}

const posthogLogger = posthogLoggerProvider?.getLogger("daftar.posthog.logs");

export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || !posthogLogger) return;

  posthogLogger.emit({
    body: "Next.js server instrumentation initialized",
    severityNumber: SeverityNumber.INFO,
    attributes: {
      event: "server_instrumentation_initialized",
      runtime: "nodejs",
    },
  });
}
