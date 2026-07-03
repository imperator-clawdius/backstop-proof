import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { ShopifyDispute, ShopifyOrder } from "../lib/shopify-types";

type GraphqlResult<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

type OrderConnection = {
  orders: {
    nodes: ShopifyOrder[];
  };
};

type OrderResult = {
  order: ShopifyOrder | null;
};

type DisputeNode = Omit<ShopifyDispute, "reason"> & {
  reasonDetails?: { reason?: string | null } | null;
  disputeEvidence?: { id?: string | null } | null;
};

type DisputesResult = {
  disputes: {
    nodes: DisputeNode[];
  };
};

type DisputeResult = {
  dispute: DisputeNode | null;
};

type DisputeEvidenceResult = {
  disputeEvidence: unknown;
};

type EvidenceUpdateResult = {
  disputeEvidenceUpdate: {
    disputeEvidence: unknown;
    userErrors: Array<{ field?: string[] | null; message: string }>;
  };
};

export class ShopifyGraphqlService {
  constructor(private readonly admin: AdminApiContext) {}

  async searchOrders(query: string): Promise<ShopifyOrder[]> {
    const data = await this.request<OrderConnection>(ORDER_SEARCH_QUERY, {
      query: query || undefined,
      first: 20,
    });
    return data.orders.nodes;
  }

  async listRecentOrders(): Promise<ShopifyOrder[]> {
    const data = await this.request<OrderConnection>(ORDER_SEARCH_QUERY, {
      first: 20,
    });
    return data.orders.nodes;
  }

  async getOrder(orderId: string): Promise<ShopifyOrder | null> {
    const data = await this.request<OrderResult>(ORDER_DETAIL_QUERY, { id: orderId });
    return data.order;
  }

  async listDisputes(): Promise<ShopifyDispute[]> {
    const data = await this.request<DisputesResult>(DISPUTES_QUERY, { first: 25 });
    return data.disputes.nodes.map(normalizeDispute);
  }

  async getDispute(disputeId: string): Promise<ShopifyDispute | null> {
    const data = await this.request<DisputeResult>(DISPUTE_QUERY, { id: disputeId });
    return data.dispute ? normalizeDispute(data.dispute) : null;
  }

  async getDisputeEvidence(evidenceId: string): Promise<unknown> {
    const data = await this.request<DisputeEvidenceResult>(DISPUTE_EVIDENCE_QUERY, {
      id: evidenceId,
    });
    return data.disputeEvidence;
  }

  async updateDisputeEvidence(evidenceId: string, input: Record<string, unknown>) {
    const data = await this.request<EvidenceUpdateResult>(DISPUTE_EVIDENCE_UPDATE_MUTATION, {
      id: evidenceId,
      input,
    });
    return data.disputeEvidenceUpdate;
  }

  private async request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await this.admin.graphql(query, { variables });
    const json = (await response.json()) as GraphqlResult<T>;
    if (json.errors?.length) {
      throw new Error(json.errors.map((error) => error.message).join("; "));
    }
    if (!json.data) throw new Error("Shopify GraphQL returned no data.");
    return json.data;
  }
}

function normalizeDispute(dispute: DisputeNode): ShopifyDispute {
  return {
    ...dispute,
    evidence: dispute.disputeEvidence,
    reason: dispute.reasonDetails?.reason ?? dispute.status ?? "UNKNOWN",
  };
}

const ORDER_FIELDS = `#graphql
  fragment BackstopOrderFields on Order {
    id
    name
    createdAt
    displayFinancialStatus
    displayFulfillmentStatus
    currencyCode
    email
    totalPriceSet { shopMoney { amount currencyCode } }
    customer { firstName lastName email numberOfOrders }
    shippingAddress { name address1 address2 city provinceCode zip countryCodeV2 }
    billingAddress { name address1 address2 city provinceCode zip countryCodeV2 }
    lineItems(first: 50) {
      nodes { title variantTitle sku quantity }
    }
    fulfillments(first: 10) {
      status
      createdAt
      deliveredAt
      trackingInfo(first: 10) { company number url }
    }
    transactions(first: 10) {
      kind
      status
      processedAt
      amountSet { shopMoney { amount currencyCode } }
    }
  }
`;

const ORDER_SEARCH_QUERY = `#graphql
  ${ORDER_FIELDS}
  query BackstopOrders($first: Int!, $query: String) {
    orders(first: $first, reverse: true, query: $query) {
      nodes { ...BackstopOrderFields }
    }
  }
`;

const ORDER_DETAIL_QUERY = `#graphql
  ${ORDER_FIELDS}
  query BackstopOrder($id: ID!) {
    order(id: $id) { ...BackstopOrderFields }
  }
`;

const DISPUTE_FIELDS = `#graphql
  fragment BackstopDisputeFields on ShopifyPaymentsDispute {
    id
    legacyResourceId
    status
    initiatedAt
    evidenceDueBy
    evidenceSentOn
    amount { amount currencyCode }
    reasonDetails { reason networkReasonCode }
    order { id name }
    disputeEvidence { id }
  }
`;

const DISPUTES_QUERY = `#graphql
  ${DISPUTE_FIELDS}
  query BackstopDisputes($first: Int!) {
    disputes(first: $first, reverse: true) {
      nodes { ...BackstopDisputeFields }
    }
  }
`;

const DISPUTE_QUERY = `#graphql
  ${DISPUTE_FIELDS}
  query BackstopDispute($id: ID!) {
    dispute(id: $id) { ...BackstopDisputeFields }
  }
`;

const DISPUTE_EVIDENCE_QUERY = `#graphql
  query BackstopDisputeEvidence($id: ID!) {
    disputeEvidence(id: $id) {
      id
      submitted
      customerFirstName
      customerLastName
      customerEmailAddress
      uncategorizedText
      refundPolicyDisclosure
      refundRefusalExplanation
      cancellationPolicyDisclosure
      cancellationRebuttal
      accessActivityLog
    }
  }
`;

const DISPUTE_EVIDENCE_UPDATE_MUTATION = `#graphql
  mutation BackstopDisputeEvidenceUpdate($id: ID!, $input: ShopifyPaymentsDisputeEvidenceUpdateInput!) {
    disputeEvidenceUpdate(id: $id, input: $input) {
      disputeEvidence { id submitted }
      userErrors { field message }
    }
  }
`;
