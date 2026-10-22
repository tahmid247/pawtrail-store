/** Instant placeholder while an admin page loads on the server. */
export default function AdminLoading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-8 h-8 w-56 rounded-lg bg-line" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-white shadow-soft" />)}
      </div>
      <div className="mt-6 h-72 rounded-2xl bg-white shadow-soft" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
