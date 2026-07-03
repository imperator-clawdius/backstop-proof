import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { missingRequiredScopes, getShopContext } from "../services/shop-context.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const context = await getShopContext(request);

  // eslint-disable-next-line no-undef
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    demoMode: context.demoMode,
    missingScopes: missingRequiredScopes(context.accessScopes),
  };
};

export default function App() {
  const { apiKey, demoMode, missingScopes } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Dashboard</s-link>
        <s-link href="/app/orders">Orders</s-link>
        <s-link href="/app/capture">Capture proof</s-link>
        <s-link href="/app/disputes">Disputes</s-link>
        <s-link href="/app/settings">Settings</s-link>
        <s-link href="/app/help">Help</s-link>
      </s-app-nav>
      {(demoMode || missingScopes.length > 0) && (
        <div style={{ padding: "12px 20px", background: "#f6f8fa", borderBottom: "1px solid #d8dee4" }}>
          {demoMode && (
            <strong>Demo mode:</strong>
          )}{" "}
          {demoMode
            ? "Using labeled demo order, dispute, and proof data. This is separate from real shop data."
            : null}
          {missingScopes.length > 0 && (
            <span>
              {" "}
              Missing scopes: {missingScopes.join(", ")}. Dispute features will degrade gracefully.
            </span>
          )}
        </div>
      )}
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
