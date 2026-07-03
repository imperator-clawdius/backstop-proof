import type { HeadersFunction } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

export default function Help() {
  return (
    <s-page heading="Help">
      <s-section heading="How Backstop Proof works">
        <s-ordered-list>
          <s-list-item>Find or scan a Shopify order.</s-list-item>
          <s-list-item>Capture product, inside-box, and sealed-label proof files.</s-list-item>
          <s-list-item>Seal the proof to lock the audit trail.</s-list-item>
          <s-list-item>Generate a merchant-reviewed PDF evidence pack and rebuttal text.</s-list-item>
          <s-list-item>For Shopify Payments disputes, prepare a draft only after explicit confirmation.</s-list-item>
        </s-ordered-list>
      </s-section>
      <s-section heading="Important limits">
        <s-paragraph>
          Backstop Proof is not a managed chargeback agency, does not provide legal advice,
          and does not guarantee dispute outcomes. The MVP does not modify checkout,
          process refunds, alter payments, or require storefront theme changes.
        </s-paragraph>
      </s-section>
      <s-section heading="Local demo">
        <s-paragraph>
          Run `npm run dev:local` after database setup to use clearly labeled demo orders,
          demo disputes, and generated proof assets without real Shopify dispute access.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
