import ShareDashboardClient from '@/components/ShareDashboardClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ token: '[token]' }];
}

export default function Page() {
  return <ShareDashboardClient />;
}
