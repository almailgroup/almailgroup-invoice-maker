import { FileQuestion } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { Card, EmptyState } from '@/components/ui/misc';

export default function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon={<FileQuestion />}
        title="Page not found"
        description="The page you were looking for doesn't exist or has moved."
        action={<ButtonLink to="/">Go to dashboard</ButtonLink>}
      />
    </Card>
  );
}
