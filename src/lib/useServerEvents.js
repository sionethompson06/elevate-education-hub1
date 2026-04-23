import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';

const TOKEN_KEY = 'elevate_auth_token';

export function useServerEvents() {
  const qc = useQueryClient();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const es = new EventSource(`/api/events?token=${encodeURIComponent(token)}`);

    const invalidateBilling = () => {
      qc.invalidateQueries({ queryKey: ['parent-family-invoices'] });
      qc.invalidateQueries({ queryKey: ['parent-my-students'] });
      qc.invalidateQueries({ queryKey: ['admin-accounting'] });
      qc.invalidateQueries({ queryKey: ['admin-enrollments'] });
    };

    es.addEventListener('billing.invoice.updated', invalidateBilling);
    es.addEventListener('billing.invoice.action', invalidateBilling);

    // Close on auth failure — don't loop on 401
    es.addEventListener('error', () => {
      if (es.readyState === EventSource.CLOSED) es.close();
    });

    return () => es.close();
  }, [qc, user?.id]);
}
