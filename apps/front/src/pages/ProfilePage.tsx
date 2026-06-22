import { useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { ApiError } from "../api/apiClient.js";
import { useAuth } from "../auth/AuthContext.js";
import { AsyncPanel, ProfileSkeleton } from "../components/AsyncState.js";
import { MatchHistoryList } from "../components/MatchHistoryList.js";
import { ProfileHeader } from "../components/ProfileHeader.js";
import { useMyHistory } from "../hooks/useMyHistory.js";
import { useProfile } from "../hooks/useProfile.js";

export function ProfilePage() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<"overview" | "history">("overview");

  const isOwnProfile = !id || id === user?.id;
  const profileUserId = isOwnProfile ? user?.id : id;

  const profileQuery = useProfile(profileUserId, isOwnProfile);
  const historyQuery = useMyHistory(isOwnProfile && activeTab === "history");

  const historyItems = useMemo(
    () => historyQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [historyQuery.data],
  );

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: id ? `/profile/${id}` : "/profile" }} />;
  }

  if (isOwnProfile && !user) {
    return null;
  }

  return (
    <div className="page">
      <section className="panel panel-wide" aria-labelledby="profile-page-title">
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
              <ProfileHeader profile={profileQuery.data} />

              {isOwnProfile ? (
                <div className="tabs" role="tablist" aria-label="Profil">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "overview"}
                    className={activeTab === "overview" ? "tab tab-active" : "tab"}
                    onClick={() => setActiveTab("overview")}
                  >
                    Aperçu
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === "history"}
                    className={activeTab === "history" ? "tab tab-active" : "tab"}
                    onClick={() => setActiveTab("history")}
                  >
                    Historique
                  </button>
                </div>
              ) : null}

              {isOwnProfile && activeTab === "history" ? (
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
              ) : null}
            </>
          ) : null}
        </AsyncPanel>
      </section>
    </div>
  );
}
