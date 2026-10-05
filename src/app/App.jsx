import CityEditor from '../features/city/editor/CityEditor.jsx';
import { lazy, Suspense } from 'react';

const ManualPage = lazy(() => import('../features/city/manual/ManualPage.jsx'));

export default function App() {
  if (window.location.hash === '#manual') return <Suspense fallback={<p role="status">매뉴얼을 불러오는 중…</p>}><ManualPage onClose={() => window.location.assign(window.location.pathname + window.location.search)} /></Suspense>;
  return <CityEditor />;
}
