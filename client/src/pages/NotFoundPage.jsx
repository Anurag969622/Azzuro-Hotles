import { Link } from 'react-router-dom';
import { Construction } from 'lucide-react';

function NotFoundPage({ placeholder }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-20">
      <Construction size={48} className="text-gray-300 mb-4" />
      {placeholder ? (
        <>
          <h2 className="text-lg font-semibold text-gray-700">Coming Soon</h2>
          <p className="text-sm text-gray-500 mt-1">{placeholder}</p>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-gray-700">Page Not Found</h2>
          <p className="text-sm text-gray-500 mt-1">The page you're looking for doesn't exist.</p>
        </>
      )}
      <Link to="/dashboard" className="mt-6 btn-primary text-sm inline-block">
        Back to Dashboard
      </Link>
    </div>
  );
}

export default NotFoundPage;

