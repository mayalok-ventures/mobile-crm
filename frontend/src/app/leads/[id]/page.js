import LeadsDetailClient from '@/components/LeadsDetailClient';

// Static export requires at least one pre-generated route for dynamic segments.
// '1' is a placeholder shell — Cloudflare's _redirects wildcard (/* → /index.html 200)
// serves this same shell for any /leads/<real-id> URL at runtime.
// The actual lead ID is read client-side by LeadsDetailClient via useParams().
export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function Page() {
  return <LeadsDetailClient />;
}
