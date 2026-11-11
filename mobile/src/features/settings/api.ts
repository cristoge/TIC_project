import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getApi } from "@/core/api";
import type { Schemas } from "@/shared/api";

export type Me = Schemas["MeOut"];

export const NAME_MAX_LENGTH = 100;

const meKey = ["me"] as const;

export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: () => getApi().get<Me>("/me") });
}

export function useUpdateName() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => getApi().patch<Me>("/me", { name }),
    onSuccess: (me) => queryClient.setQueryData(meKey, me),
  });
}
