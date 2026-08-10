import { useEffect, useState } from "react";
import { api } from "../api/client";

interface Customer {
  id: string;
  name: string;
}
interface Product {
  id: string;
  name: string;
  sku: string;
  currentStock: number;
}
interface ChallanItem {
  productId: string;
  productName: string;
  quantity: number;
}
interface Challan {
  id: string;
  challanNumber: string;
  status: string;
  totalQuantity: number;
  customer: { name: string };
  items: { productName: string; quantity: number }[];
}

export default function Challans() {
  const [challans, setChallans] = useState<Challan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [items, setItems] = useState<ChallanItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");

  async function fetchAll() {
    const [challanRes, customerRes, productRes] = await Promise.all([
      api.get("/challans"),
      api.get("/customers", { params: { limit: 100 } }),
      api.get("/products", { params: { limit: 100 } }),
    ]);
    setChallans(challanRes.data.data);
    setCustomers(customerRes.data.data);
    setProducts(productRes.data.data);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  function addItem() {
    if (!selectedProduct || !quantity || Number(quantity) <= 0) return;
    const product = products.find((p) => p.id === selectedProduct);
    if (!product) return;
    if (items.some((i) => i.productId === selectedProduct)) {
      setError("Product already added — remove it first to change quantity");
      return;
    }
    setItems([...items, { productId: product.id, productName: product.name, quantity: Number(quantity) }]);
    setSelectedProduct("");
    setQuantity("");
    setError("");
  }

  function removeItem(productId: string) {
    setItems(items.filter((i) => i.productId !== productId));
  }

  async function handleCreateChallan() {
    if (!customerId || items.length === 0) {
      setError("Select a customer and add at least one product");
      return;
    }
    setError("");
    try {
      await api.post("/challans", {
        customerId,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      setCustomerId("");
      setItems([]);
      setShowForm(false);
      fetchAll();
    } catch (e: any) {
      setError(e.response?.data?.error || "Failed to create challan");
    }
  }

  async function confirmChallan(id: string) {
    if (!window.confirm("Confirm this challan? This will deduct stock and cannot be undone.")) return;
    try {
      await api.post(`/challans/${id}/confirm`);
      fetchAll();
    } catch (e: any) {
      alert(e.response?.data?.error || "Failed to confirm challan");
    }
  }

  async function cancelChallan(id: string) {
    if (!window.confirm("Cancel this challan?")) return;
    try {
      await api.post(`/challans/${id}/cancel`);
      fetchAll();
    } catch (e: any) {
      alert(e.response?.data?.error || "Failed to cancel challan");
    }
  }

  return (
    <div>
      <h2>Sales Challans</h2>

      <button onClick={() => setShowForm(!showForm)} style={{ marginBottom: 20 }}>
        {showForm ? "Cancel" : "+ New Challan"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {showForm && (
        <div style={{ marginBottom: 20, padding: 16, border: "1px solid #ccc" }}>
          <div style={{ marginBottom: 12 }}>
            <label>Customer: </label>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
            <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} (stock: {p.currentStock})</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Qty"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              style={{ width: 80 }}
            />
            <button type="button" onClick={addItem}>Add Item</button>
          </div>

          {items.length > 0 && (
            <table style={{ width: "100%", marginBottom: 12 }}>
              <tbody>
                {items.map((i) => (
                  <tr key={i.productId}>
                    <td>{i.productName}</td>
                    <td>{i.quantity}</td>
                    <td>
                      <button type="button" onClick={() => removeItem(i.productId)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <button onClick={handleCreateChallan}>Save as Draft</button>
        </div>
      )}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
            <th style={{ padding: 8 }}>Challan #</th>
            <th style={{ padding: 8 }}>Customer</th>
            <th style={{ padding: 8 }}>Items</th>
            <th style={{ padding: 8 }}>Status</th>
            <th style={{ padding: 8 }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {challans.map((c) => (
            <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 8 }}>{c.challanNumber}</td>
              <td style={{ padding: 8 }}>{c.customer.name}</td>
              <td style={{ padding: 8 }}>
                {c.items.map((i) => `${i.productName} x${i.quantity}`).join(", ")}
              </td>
              <td style={{ padding: 8 }}>{c.status}</td>
              <td style={{ padding: 8 }}>
                {c.status === "DRAFT" && (
                  <>
                    <button onClick={() => confirmChallan(c.id)} style={{ marginRight: 6 }}>Confirm</button>
                    <button onClick={() => cancelChallan(c.id)}>Cancel</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}