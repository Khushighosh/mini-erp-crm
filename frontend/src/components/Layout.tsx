import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "sans-serif" }}>
      <aside style={{ width: 200, background: "#1e293b", color: "#fff", padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Mini ERP</h3>
        <nav style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Link to="/customers" style={{ color: "#fff" }}>Customers</Link>
          <Link to="/products" style={{ color: "#fff" }}>Products</Link>
          <Link to="/challans" style={{ color: "#fff" }}>Challans</Link>
        </nav>
        <div style={{ marginTop: 40, fontSize: 14 }}>
          <p>{user?.name}</p>
          <p style={{ opacity: 0.7 }}>{user?.role}</p>
          <button onClick={handleLogout} style={{ marginTop: 10 }}>Logout</button>
        </div>
      </aside>
      <main style={{ flex: 1, padding: 30 }}>
        <Outlet />
      </main>
    </div>
  );
}