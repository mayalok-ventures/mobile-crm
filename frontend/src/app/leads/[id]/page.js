import LeadsDetailClient from '@/components/LeadsDetailClient';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ id: '[id]' }];
}

export default function Page() {
  return <LeadsDetailClient />;
}
