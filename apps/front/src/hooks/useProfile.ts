import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "../api/apiClient.js";
import type { MeProfile, PublicProfile } from "../api/types.js";

export type OwnProfileData = {
  kind: "own";
  me: MeProfile;
  stats: PublicProfile;
};

export type OtherProfileData = {
  kind: "other";
  stats: PublicProfile;
};

export type ProfileData = OwnProfileData | OtherProfileData;

export function useProfile(userId: string | undefined, isOwnProfile: boolean) {
  return useQuery({
    queryKey: ["profile", userId, isOwnProfile],
    enabled: Boolean(userId),
    queryFn: async (): Promise<ProfileData> => {
      if (!userId) {
        throw new Error("Missing user id");
      }

      if (isOwnProfile) {
        const [me, stats] = await Promise.all([
          apiRequest<MeProfile>("/me"),
          apiRequest<PublicProfile>(`/users/${userId}/profile`),
        ]);
        return { kind: "own", me, stats };
      }

      const stats = await apiRequest<PublicProfile>(`/users/${userId}/profile`);
      return { kind: "other", stats };
    },
  });
}
