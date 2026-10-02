import { RouterProvider } from 'react-router';
import { Toaster } from 'sonner';
import { ConfirmProvider } from '@/components/ui/overlay';
import { router } from '@/app/router';

export default function App() {
  return (
    <ConfirmProvider>
      <RouterProvider router={router} />
      <Toaster position="bottom-right" richColors closeButton />
    </ConfirmProvider>
  );
}
