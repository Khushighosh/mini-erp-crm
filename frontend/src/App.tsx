import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/customers" element={<div>Customers page coming next</div>} />
          </Route>
          <Route path="*" element={<Navigate to="/customers" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;