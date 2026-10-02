import { Card, EmptyState, PageHeader } from '@/components/ui/misc';

export default function Page() {
  return (
    <div>
      <PageHeader title="not-found" />
      <Card>
        <EmptyState title="Coming soon" />
      </Card>
    </div>
  );
}
