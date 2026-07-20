import ShareDashboardClient from '@/components/ShareDashboardClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ token: 'placeholder' }];
}

export default function Page() {
  return <ShareDashboardClient />;
}
