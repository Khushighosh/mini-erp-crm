import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api } from "../api/client";

interface Product {
  id: string;
  name: string;
  sku: string;
  category?: string;
  unitPrice: number;
  currentStock: number;
  minStockAlert: number;
  location?: string;
}

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    unitPrice: "",
    currentStock: "",
    minStockAlert: "",
    location: "",
  });

  async function fetchProducts() {
    setLoading(true);
    try {
      const res = await api.get("/products", { params: { search } });
      setProducts(res.data.data);
    } catch {
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function handleAddProduct(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/products", {
        ...form,
        unitPrice: parseFloat(form.unitPrice),
        currentStock: form.currentStock ? parseInt(form.currentStock) : 0,
        minStockAlert: form.minStockAlert ? parseInt(form.minStockAlert) : 0,
      });
      setForm({ name: "", sku: "", category: "", unitPrice: "", currentStock: "", minStockAlert: "", location: "" });
      setShowForm(false);
      fetchProducts();
    } catch {
      setError("Failed to add product — check required fields or duplicate SKU");
    }
  }

  async function adjustStock(productId: string, movementType: "IN" | "OUT") {
    const qty = prompt(`Enter quantity to ${movementType === "IN" ? "add" : "remove"}:`);
    if (!qty || isNaN(Number(qty))) return;
    try {
      await api.post(`/products/${productId}/stock-movement`, {
        quantity: parseInt(qty),
        movementType,
        reason: "Manual adjustment",
      });
      fetchProducts();
    } catch (e: any) {
      alert(e.response?.data?.error || "Failed to adjust stock");
    }
  }

  return (
    <div>
      <h2>Products</h2>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <input
          placeholder="Search by name or SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: 8, flex: 1 }}
        />
        <button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Product"}
        </button>
      </div>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {showForm && (
        <form onSubmit={handleAddProduct} style={{ marginBottom: 20, padding: 16, border: "1px solid #ccc" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <input
              placeholder="Name *"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              placeholder="SKU *"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              required
            />
            <input
              placeholder="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
            <input
              placeholder="Unit Price *"
              type="number"
              step="0.01"
              value={form.unitPrice}
              onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
              required
            />
            <input
              placeholder="Current Stock"
              type="number"
              value={form.currentStock}
              onChange={(e) => setForm({ ...form, currentStock: e.target.value })}
            />
            <input
              placeholder="Min Stock Alert"
              type="number"
              value={form.minStockAlert}
              onChange={(e) => setForm({ ...form, minStockAlert: e.target.value })}
            />
            <input
              placeholder="Location"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
            />
          </div>
          <button type="submit" style={{ marginTop: 10 }}>Save Product</button>
        </form>
      )}

      {loading ? (
        <p>Loading...</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid #ccc" }}>
              <th style={{ padding: 8 }}>Name</th>
              <th style={{ padding: 8 }}>SKU</th>
              <th style={{ padding: 8 }}>Price</th>
              <th style={{ padding: 8 }}>Stock</th>
              <th style={{ padding: 8 }}>Location</th>
              <th style={{ padding: 8 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: 8 }}>{p.name}</td>
                <td style={{ padding: 8 }}>{p.sku}</td>
                <td style={{ padding: 8 }}>₹{p.unitPrice}</td>
                <td style={{ padding: 8, color: p.currentStock <= p.minStockAlert ? "red" : "inherit" }}>
                  {p.currentStock}
                </td>
                <td style={{ padding: 8 }}>{p.location || "-"}</td>
                <td style={{ padding: 8 }}>
                  <button onClick={() => adjustStock(p.id, "IN")} style={{ marginRight: 6 }}>+IN</button>
                  <button onClick={() => adjustStock(p.id, "OUT")}>-OUT</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
