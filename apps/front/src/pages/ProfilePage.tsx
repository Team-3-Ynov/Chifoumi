import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError } from "../api/apiClient.js";
import { useAuth } from "../auth/AuthContext.js";
import { AsyncPanel, ProfileSkeleton } from "../components/AsyncState.js";
import { MatchHistoryList } from "../components/MatchHistoryList.js";
import { ProfileHeader } from "../components/ProfileHeader.js";
import { useCurrentSeason } from "../hooks/useCurrentSeason.js";
import { useMyHistory } from "../hooks/useMyHistory.js";
import { useProfile } from "../hooks/useProfile.js";

export function ProfilePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");

  const isOwnProfile = !id || id === user?.id;
  const profileUserId = isOwnProfile ? user?.id : id;

  const profileQuery = useProfile(profileUserId, isOwnProfile);
  const currentSeasonQuery = useCurrentSeason(Boolean(profileUserId) && isOwnProfile);
  const historyQuery = useMyHistory(user?.id, isOwnProfile && activeTab === "history");

  const historyItems = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [historyQuery.data],
  );

  return (
    <div className="page">
      <section className="panel panel-wide" aria-labelledby="profile-page-title">
        <h1 id="profile-page-title" className="sr-only">
          Profil joueur
        </h1>

        <AsyncPanel
          isLoading={profileQuery.isLoading}
          isError={profileQuery.isError}
          errorMessage={
            profileQuery.error instanceof ApiError && profileQuery.error.status === 404
              ? "Joueur introuvable."
              : profileQuery.error instanceof Error
                ? profileQuery.error.message
                : undefined
          }
          onRetry={() => void profileQuery.refetch()}
          skeleton={<ProfileSkeleton />}
        >
          {profileQuery.data ? (
            <>
              <ProfileHeader
                profile={profileQuery.data}
                progressToNextLeague={currentSeasonQuery.data?.me.progressToNextLeague}
              />

              {isOwnProfile ? (
                <div className="tabs" role="tablist" aria-label="Profil">
                  <button
                    type="button"
                    id="profile-tab-overview"
                    role="tab"
                    aria-selected={activeTab === "overview"}
                    aria-controls="profile-tabpanel-overview"
                    className={activeTab === "overview" ? "tab tab-active" : "tab"}
                    onClick={() => setActiveTab("overview")}
                  >
                    Aperçu
                  </button>
                  <button
                    type="button"
                    id="profile-tab-history"
                    role="tab"
                    aria-selected={activeTab === "history"}
                    aria-controls="profile-tabpanel-history"
                    className={activeTab === "history" ? "tab tab-active" : "tab"}
                    onClick={() => setActiveTab("history")}
                  >
                    Historique
                  </button>
                </div>
              ) : null}

              {isOwnProfile && activeTab === "overview" ? (
                <div
                  id="profile-tabpanel-overview"
                  role="tabpanel"
                  aria-labelledby="profile-tab-overview"
                />
              ) : null}

              {isOwnProfile && activeTab === "history" ? (
                <div
                  id="profile-tabpanel-history"
                  role="tabpanel"
                  aria-labelledby="profile-tab-history"
                >
                  <MatchHistoryList
                    items={historyItems}
                    isLoading={historyQuery.isLoading}
                    isError={historyQuery.isError}
                    errorMessage={
                      historyQuery.error instanceof Error ? historyQuery.error.message : undefined
                    }
                    onRetry={() => void historyQuery.refetch()}
                    hasNextPage={historyQuery.hasNextPage}
                    isFetchingNextPage={historyQuery.isFetchingNextPage}
                    onLoadMore={() => void historyQuery.fetchNextPage()}
                  />
                </div>
              ) : null}
            </>
          ) : null}
        </AsyncPanel>
      </section>
    </div>
  );
}
