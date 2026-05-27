/** Shared skeleton primitives for page-level loading states. */

function Bone({ className = '' }) {
  return <div className={`rounded bg-brand-elevated ${className}`} />
}

function PageHeaderSkeleton({ hasBack = true }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 border-b border-brand-border">
      {hasBack && <Bone className="w-9 h-9 rounded-full flex-shrink-0" />}
      <div className="flex flex-col gap-1.5 flex-1">
        <Bone className="h-4 w-28" />
        <Bone className="h-3 w-20" />
      </div>
    </div>
  )
}

// ── Match card row ────────────────────────────────────────────────
function MatchCardSkeleton() {
  return (
    <div className="card mb-3 flex items-center gap-3 px-4 py-3">
      {/* home */}
      <div className="flex flex-col items-center gap-1 flex-1">
        <Bone className="w-9 h-9 rounded-xl" />
        <Bone className="h-2.5 w-14" />
      </div>
      {/* center */}
      <div className="flex flex-col items-center gap-1.5 flex-shrink-0 px-2">
        <Bone className="h-2 w-20" />
        <Bone className="h-5 w-14 rounded-lg" />
      </div>
      {/* away */}
      <div className="flex flex-col items-center gap-1 flex-1">
        <Bone className="w-9 h-9 rounded-xl" />
        <Bone className="h-2.5 w-14" />
      </div>
    </div>
  )
}

// ── Filter chip row ───────────────────────────────────────────────
function FilterChipsSkeleton({ count = 6 }) {
  const widths = ['w-14', 'w-16', 'w-10', 'w-10', 'w-10', 'w-10', 'w-14']
  return (
    <div className="flex gap-2 pb-3 overflow-hidden -mx-4 px-4">
      {Array.from({ length: count }).map((_, i) => (
        <Bone key={i} className={`h-8 flex-shrink-0 rounded-full ${widths[i] || 'w-12'}`} />
      ))}
    </div>
  )
}

// ── Matches / MatchPredictions page ──────────────────────────────
export function MatchListSkeleton({ hasPageHeader = false }) {
  return (
    <div className="page max-w-md mx-auto px-4 pt-6 animate-pulse">
      {hasPageHeader
        ? <PageHeaderSkeleton />
        : <Bone className="h-7 w-24 mb-4" />
      }
      <div className={hasPageHeader ? 'px-0 pt-3' : ''}>
        <FilterChipsSkeleton />
        {Array.from({ length: 6 }).map((_, i) => <MatchCardSkeleton key={i} />)}
      </div>
    </div>
  )
}

// ── Groups page ──────────────────────────────────────────────────
export function GroupListSkeleton() {
  return (
    <div className="page max-w-md mx-auto px-4 pt-6 animate-pulse">
      <div className="flex items-center justify-between mb-5">
        <Bone className="h-7 w-28" />
        <Bone className="h-9 w-24 rounded-xl" />
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card mb-3 flex items-center gap-3 px-4 py-4">
          <Bone className="w-10 h-10 rounded-xl flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Bone className="h-4 w-32" />
            <Bone className="h-3 w-20" />
          </div>
          <Bone className="w-5 h-5 rounded flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

// ── Leaderboard page ─────────────────────────────────────────────
export function LeaderboardSkeleton() {
  return (
    <div className="page max-w-md mx-auto animate-pulse">
      <PageHeaderSkeleton />
      <div className="px-4 pt-4">
        {/* scope selector */}
        <div className="card mb-4 p-3">
          <Bone className="h-3 w-20 mb-2" />
          <Bone className="h-10 w-full rounded-xl" />
        </div>
        {/* my position card */}
        <div className="card mb-4 flex items-center gap-3 px-4 py-3">
          <Bone className="w-8 h-8 rounded-xl flex-shrink-0" />
          <Bone className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 flex flex-col gap-1.5">
            <Bone className="h-4 w-24" />
            <Bone className="h-3 w-16" />
          </div>
          <Bone className="h-5 w-12 rounded-lg flex-shrink-0" />
        </div>
        {/* leaderboard rows */}
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-3 border-b border-brand-border/40">
            <Bone className="w-8 h-8 rounded-xl flex-shrink-0" />
            <Bone className="w-10 h-10 rounded-full flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <Bone className="h-3.5 w-28" />
              <Bone className="h-2.5 w-16" />
            </div>
            <Bone className="h-5 w-12 rounded-lg flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── TournamentPredictions page ───────────────────────────────────
export function TournamentPredictionsSkeleton() {
  return (
    <div className="page max-w-md mx-auto animate-pulse">
      <PageHeaderSkeleton />
      <div className="px-4 pt-4 flex flex-col gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="card flex items-center gap-3 px-4 py-4">
            <Bone className="w-9 h-9 rounded-xl flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <Bone className="h-3.5 w-32" />
              <Bone className="h-2.5 w-16" />
            </div>
            <Bone className="h-10 w-36 rounded-xl flex-shrink-0" />
          </div>
        ))}
        <Bone className="h-12 w-full rounded-xl mt-2" />
      </div>
    </div>
  )
}

// ── Profile page ─────────────────────────────────────────────────
export function ProfileSkeleton() {
  return (
    <div className="page max-w-md mx-auto pb-24 animate-pulse">
      <PageHeaderSkeleton />
      <div className="px-4 pt-6">
        {/* avatar */}
        <div className="flex flex-col items-center mb-8 gap-3">
          <Bone className="w-24 h-24 rounded-full" />
          <Bone className="h-5 w-36" />
          <Bone className="h-3.5 w-24" />
        </div>
        {/* settings cards */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card mb-3 px-4 py-4">
            <Bone className="h-4 w-28 mb-3" />
            <Bone className="h-10 w-full rounded-xl" />
          </div>
        ))}
        <Bone className="h-12 w-full rounded-xl mt-4" />
      </div>
    </div>
  )
}

// ── GroupDashboard page ──────────────────────────────────────────
export function GroupDashboardSkeleton() {
  return (
    <div className="page max-w-md mx-auto animate-pulse">
      <PageHeaderSkeleton />
      <div className="px-4 pt-4 flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card flex items-center gap-4 px-4 py-5">
            <Bone className="w-10 h-10 rounded-xl flex-shrink-0" />
            <div className="flex-1 flex flex-col gap-1.5">
              <Bone className="h-4 w-40" />
              <Bone className="h-3 w-52" />
            </div>
            <Bone className="w-5 h-5 rounded flex-shrink-0" />
          </div>
        ))}
        {/* members section */}
        <div className="card px-4 py-4 mt-1">
          <Bone className="h-4 w-24 mb-4" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-brand-border/40 last:border-0">
              <Bone className="w-8 h-8 rounded-full flex-shrink-0" />
              <Bone className="h-3.5 flex-1" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
