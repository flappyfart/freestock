export const metadata = {
  title: 'Dashboard',
  alternates: { canonical: '/dashboard' },
  robots: { index: false, follow: false },
};
import LiveWorkspace from '../live/live-workspace';
export default function Page() {
  return <LiveWorkspace />;
}
