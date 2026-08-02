export function ProductPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="aspect-square w-full animate-pulse rounded-2xl bg-sand" />
        <div className="space-y-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-primary/10" />
          <div className="h-9 w-3/4 animate-pulse rounded bg-primary/10" />
          <div className="h-4 w-1/2 animate-pulse rounded bg-primary/10" />
          <div className="h-7 w-1/4 animate-pulse rounded bg-primary/10" />
          <div className="h-24 w-full animate-pulse rounded bg-primary/10" />
          <div className="h-10 w-2/3 animate-pulse rounded bg-primary/10" />
        </div>
      </div>
      <p className="mt-8 text-sm text-muted-foreground">Loading product…</p>
    </div>
  );
}
