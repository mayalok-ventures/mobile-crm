import CampaignDetailsClient from '@/components/CampaignDetailsClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ id: '1' }];
}

export default function Page() {
  return <CampaignDetailsClient />;
}
