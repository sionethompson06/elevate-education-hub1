import { Navigate } from "react-router-dom";

// This route was superseded by /parent/payments (PaymentsBilling.jsx).
// Redirect any bookmark or direct navigation here to the correct page.
export default function Billing() {
  return <Navigate to="/parent/payments" replace />;
}
