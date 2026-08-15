import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ChevronDown,
  Heart,
  Menu,
  Package,
  Search,
  ShoppingBag,
  User,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMappedFeaturedProducts,
  useMappedSearchProducts,
  type MappedMedusaProduct,
} from "@/lib/medusa-hooks";
import { formatPrice } from "@/lib/products";
import { useShop } from "@/lib/store";

const navLink =
  "text-sm font-medium text-foreground/80 transition-colors hover:text-primary";

// Small inline debounce so keystrokes don't fire a Medusa search per character.
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function SearchResultRow({
  product,
  onSelect,
}: {
  product: MappedMedusaProduct;
  onSelect: () => void;
}) {
  return (
    <li>
      <Link
        to="/product/$slug"
        params={{ slug: product.slug }}
        onClick={onSelect}
        className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-secondary"
      >
        <img src={product.images[0]} alt="" width={48} height={48} loading="lazy" className="size-12 rounded object-cover" />
        <span className="flex-1">
          <span className="block text-sm font-medium">{product.name}</span>
          <span className="block text-xs text-muted-foreground">{product.tagline}</span>
        </span>
        <span className="text-sm">{formatPrice(product.price)}</span>
      </Link>
    </li>
  );
}

function SearchLoadingRows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-center gap-3 p-2">
          <Skeleton className="size-12 shrink-0 rounded" />
          <span className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </span>
          <Skeleton className="h-4 w-14" />
        </li>
      ))}
    </>
  );
}

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 300);
  const searchTerm = debouncedQ.trim();
  const hasQuery = q.trim().length > 0;

  // Gated on `open` so no fetch fires while the dialog is closed (it stays
  // mounted in the header).
  const featured = useMappedFeaturedProducts(4, open);
  const search = useMappedSearchProducts(searchTerm, 8);

  const close = () => onOpenChange(false);
  const searchResults = search.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Search Daily Drip</DialogTitle>
        </DialogHeader>
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Try “serum”, “hair oil”, “dry skin”…"
        />
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {hasQuery ? (
            searchTerm.length === 0 || search.isPending ? (
              <SearchLoadingRows />
            ) : search.isError ? (
              <li className="p-3 text-sm text-muted-foreground">
                Search is temporarily unavailable — please try again later.
              </li>
            ) : searchResults.length === 0 ? (
              <li className="p-3 text-sm text-muted-foreground">No products matched “{q}”.</li>
            ) : (
              searchResults.map((p) => <SearchResultRow key={p.slug} product={p} onSelect={close} />)
            )
          ) : (
            <>
              <li className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Popular right now
              </li>
              {featured.isPending ? (
                <SearchLoadingRows />
              ) : featured.isError ? (
                <li className="p-3 text-sm text-muted-foreground">
                  Search is temporarily unavailable — please try again later.
                </li>
              ) : featured.data && featured.data.length > 0 ? (
                featured.data.map((p) => <SearchResultRow key={p.slug} product={p} onSelect={close} />)
              ) : (
                <li className="p-3 text-sm text-muted-foreground">
                  No products yet — check back soon.
                </li>
              )}
            </>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

export function Header() {
  const { cartCount, wishlist } = useShop();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-4 px-4">
        <div className="flex items-center gap-4 justify-self-start">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild className="lg:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-6">
              <SheetTitle className="font-display text-xl">Daily Drip</SheetTitle>
              <nav className="mt-6 flex flex-col gap-4">
                <Link to="/shop" className={navLink} onClick={() => setMenuOpen(false)}>Shop All</Link>
                <Link to="/skin-care" className={navLink} onClick={() => setMenuOpen(false)}>Skin Care</Link>
                <Link to="/hair-care" className={navLink} onClick={() => setMenuOpen(false)}>Hair Care</Link>
                <Link to="/track-order" className={navLink} onClick={() => setMenuOpen(false)}>Track Order</Link>
                <Link to="/blogs" className={navLink} onClick={() => setMenuOpen(false)}>Blogs</Link>
                <Link to="/account" className={navLink} onClick={() => setMenuOpen(false)}>Account / Sign Up</Link>
              </nav>
            </SheetContent>
          </Sheet>

          <nav className="hidden items-center gap-6 lg:flex">
            <DropdownMenu>
              <DropdownMenuTrigger className={navLink + " flex items-center gap-1 outline-none"}>
                Shop <ChevronDown size={14} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  What would you like to shop?
                </DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <Link to="/skin-care">Skin Care</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/hair-care">Hair Care</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/shop">Shop everything</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to="/hair-care" className={navLink}>Hair Care</Link>
            <Link to="/skin-care" className={navLink}>Skin Care</Link>
            <Link to="/track-order" className={navLink + " flex items-center gap-1"}>
              <Package size={14} /> Track Order
            </Link>
          </nav>
        </div>

        <Link to="/" className="flex shrink-0 items-center" aria-label="Daily Drip home">
          <img src="/dailydrip_logo.png" alt="Daily Drip" className="h-12 w-auto" />
        </Link>

        <div className="flex items-center gap-1 justify-self-end">
          <Button variant="ghost" size="icon" aria-label="Search" onClick={() => setSearchOpen(true)}>
            <Search />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Wishlist" asChild>
            <Link to="/wishlist" className="relative">
              <Heart />
              {wishlist.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                  {wishlist.length}
                </span>
              )}
            </Link>
          </Button>
          <Button variant="ghost" size="icon" aria-label="Cart" asChild>
            <Link to="/cart" className="relative">
              <ShoppingBag />
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
                  {cartCount}
                </span>
              )}
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="ml-1 hidden sm:inline-flex">
            <Link to="/account">
              <User size={15} /> Account
            </Link>
          </Button>
        </div>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}