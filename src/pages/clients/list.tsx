import { Card, EmptyState, PageHeader } from '@/components/ui/misc';

export default function Page() {
  return (
    <div>
      <PageHeader title="clients/list" />
      <Card>
        <EmptyState title="Coming soon" />
      </Card>
    </div>
  );
}
