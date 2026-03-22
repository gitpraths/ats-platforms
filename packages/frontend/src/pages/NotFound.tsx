import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <h1 className="text-6xl font-bold text-gray-200 mb-2">404</h1>
      <p className="text-xl font-semibold text-gray-700 mb-1">Page not found</p>
      <p className="text-sm text-gray-400 mb-6">The page you're looking for doesn't exist.</p>
      <Link
        to="/dashboard"
        className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
