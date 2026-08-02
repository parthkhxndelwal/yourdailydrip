import { Link } from "@tanstack/react-router";
import { Leaf } from "lucide-react";

import { Button } from "@/components/ui/button";

export function ProductUnavailable() {
  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center px-4 py-20 text-center">
      <Leaf className="size-10 text-leaf" />
      <h1 className="mt-4 text-2xl">This product is unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        It may have sold out or the link may be incorrect.
      </p>
      <Button className="mt-6" asChild>
        <Link to="/shop">Browse the shop</Link>
      </Button>
    </div>
  );
}
