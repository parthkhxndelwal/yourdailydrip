import { useState } from "react";
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
import { formatPrice, products } from "@/lib/products";
import { useShop } from "@/lib/store";

const navLink =
  "text-sm font-medium text-foreground/80 transition-colors hover:text-primary";

function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [q, setQ] = useState("");
  const results = q.trim()
    ? products.filter((p) =>
        (p.name + p.tagline + p.category).toLowerCase().includes(q.trim().toLowerCase()),
      )
    : products.slice(0, 4);

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
          {results.map((p) => (
            <li key={p.slug}>
              <Link
                to="/product/$slug"
                params={{ slug: p.slug }}
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-secondary"
              >
                <img src={p.images[0]} alt="" width={48} height={48} loading="lazy" className="size-12 rounded object-cover" />
                <span className="flex-1">
                  <span className="block text-sm font-medium">{p.name}</span>
                  <span className="block text-xs text-muted-foreground">{p.tagline}</span>
                </span>
                <span className="text-sm">{formatPrice(p.price)}</span>
              </Link>
            </li>
          ))}
          {results.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">No products matched “{q}”.</li>
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
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
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

        <Link to="/" className="font-display text-xl leading-none tracking-tight">
          Daily<span className="text-leaf">Drip</span>
        </Link>

        <nav className="ml-6 hidden items-center gap-6 lg:flex">
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

        <div className="ml-auto flex items-center gap-1">
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