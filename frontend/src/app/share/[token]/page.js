import ShareDashboardClient from '@/components/ShareDashboardClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ token: '1' }];
}

export default function Page() {
  return <ShareDashboardClient />;
}
