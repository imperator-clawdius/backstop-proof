import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";

import { login } from "../../shopify.server";

import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      <div className={styles.content}>
        <h1 className={styles.heading}>Backstop Proof</h1>
        <p className={styles.text}>
          Packing proof and chargeback evidence packs for Shopify orders.
        </p>
        {showForm && (
          <Form className={styles.form} method="post" action="/auth/login">
            <label className={styles.label}>
              <span>Shop domain</span>
              <input className={styles.input} type="text" name="shop" />
              <span>e.g: my-shop-domain.myshopify.com</span>
            </label>
            <button className={styles.button} type="submit">
              Log in
            </button>
          </Form>
        )}
        <ul className={styles.list}>
          <li>
            <strong>Capture packing proof</strong>. Upload product, inside-box,
            and sealed-label proof before shipment.
          </li>
          <li>
            <strong>Seal evidence</strong>. Store SHA-256 hashes and a
            reviewable audit trail.
          </li>
          <li>
            <strong>Generate evidence packs</strong>. Prepare merchant-reviewed
            PDFs and rebuttal text without guaranteed-win claims.
          </li>
        </ul>
      </div>
    </div>
  );
}
