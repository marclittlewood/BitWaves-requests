import { useQuery, UseQueryResult, useMutation, useQueryClient } from "@tanstack/react-query";
import { RequestDto } from "../../../shared/RequestDto";

export function useRequestsQuery(
  token?: string | null,
  onAuthError?: () => void
): UseQueryResult<RequestDto[], Error> {
  return useQuery<RequestDto[], Error>({
    queryKey: ['requests', token],
    queryFn: async () => {
      const headers: HeadersInit = {};
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch('/api/requests?status=all&limit=200', { headers ,
    refetchInterval: 5000,
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });
      if (!response.ok) {
        if (response.status === 401 && onAuthError) onAuthError();
        throw new Error('Failed to fetch requests');
      }
      return response.json();
    },
    refetchInterval: 5000
  });
}

export function useDeleteRequestMutation(token?: string | null, onAuthError?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`/api/requests/${requestId}`, {
        method: 'DELETE',
        headers
      });
      if (!response.ok) {
        if (response.status === 401) {
          if (onAuthError) onAuthError();
          throw new Error('Authentication failed');
        }
        throw new Error('Failed to delete request');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', token] });
    }
  });
}

export function useHoldRequestMutation(token?: string | null, onAuthError?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`/api/requests/${requestId}/hold`, { method: 'POST', headers });
      if (!response.ok) {
        if (response.status === 401) {
          if (onAuthError) onAuthError();
          throw new Error('Authentication failed');
        }
        throw new Error('Failed to hold request');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', token] });
    }
  });
}

export function useProcessRequestMutation(token?: string | null, onAuthError?: () => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await fetch(`/api/requests/${requestId}/process`, { method: 'POST', headers });
      if (!response.ok) {
        if (response.status === 401) {
          if (onAuthError) onAuthError();
          throw new Error('Authentication failed');
        }
        throw new Error('Failed to process request');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests', token] });
    }
  });
}
