import serum from "@/assets/p-serum.jpg";
import cleanser from "@/assets/p-cleanser.jpg";
import cream from "@/assets/p-cream.jpg";
import hairoil from "@/assets/p-hairoil.jpg";
import shampoo from "@/assets/p-shampoo.jpg";
import hairmask from "@/assets/p-hairmask.jpg";
import scalp from "@/assets/p-scalp.jpg";

export type Review = {
  name: string;
  rating: number;
  date: string;
  title: string;
  body: string;
};

export type Product = {
  slug: string;
  /** Medusa variant id (present on Medusa-mapped products) used by add-to-cart. */
  variantId?: string;
  name: string;
  category: "skin-care" | "hair-care";
  tagline: string;
  price: number;
  mrp?: number;
  size: string;
  stock: number;
  images: string[];
  shortDescription: string;
  description: string;
  benefits: string[];
  ingredients: string[];
  howToUse: string[];
  suitableFor: string;
  rating: number;
  reviews: Review[];
};

const baseReviews = (a: string, b: string): Review[] => [
  {
    name: "Ananya R.",
    rating: 5,
    date: "12 June 2026",
    title: "Worth every rupee",
    body: a,
  },
  {
    name: "Meera K.",
    rating: 4,
    date: "28 May 2026",
    title: "Gentle and effective",
    body: b,
  },
  {
    name: "Rahul S.",
    rating: 5,
    date: "9 May 2026",
    title: "Repurchasing already",
    body: "Light texture, clean scent and my routine finally feels consistent. Delivery was quick too.",
  },
];

export const products: Product[] = [
  {
    slug: "clarity-vitamin-c-serum",
    name: "Clarity Vitamin C Serum",
    category: "skin-care",
    tagline: "Brightening daily serum",
    price: 749,
    mrp: 1099,
    size: "30 ml",
    stock: 24,
    images: [serum, cream, cleanser],
    shortDescription:
      "A lightweight 10% vitamin C serum that fades dullness and evens skin tone in 6 weeks.",
    description:
      "Clarity pairs stabilised 10% ethyl ascorbic acid with ferulic acid and Indian gooseberry extract to target uneven tone, post-acne marks and early photo-damage. The water-light base absorbs in seconds without pilling under sunscreen, making it an easy first step in any morning routine. Dermatologically tested, fragrance-free and formulated without alcohol or essential oils.",
    benefits: [
      "Visibly brightens dull, tired-looking skin",
      "Helps fade dark spots and post-acne marks",
      "Antioxidant defence against daily pollution",
      "Non-sticky finish that layers under SPF",
    ],
    ingredients: [
      "10% Ethyl Ascorbic Acid (Vitamin C)",
      "0.5% Ferulic Acid",
      "Amla (Indian Gooseberry) Extract",
      "Sodium Hyaluronate",
      "Glycerin, Panthenol (Vitamin B5)",
    ],
    howToUse: [
      "Cleanse and pat skin dry.",
      "Apply 3–4 drops to face and neck each morning.",
      "Follow with moisturiser and broad-spectrum SPF 30+.",
    ],
    suitableFor: "All skin types, including sensitive and acne-prone skin",
    rating: 4.7,
    reviews: baseReviews(
      "My pigmentation from last summer has genuinely lightened. No stinging at all, which is rare for me with vitamin C.",
      "Absorbs beautifully and never pills under sunscreen. I use it every morning before work.",
    ),
  },
  {
    slug: "calm-gel-cleanser",
    name: "Calm Gel Cleanser",
    category: "skin-care",
    tagline: "Sulphate-free daily wash",
    price: 449,
    mrp: 599,
    size: "120 ml",
    stock: 61,
    images: [cleanser, serum, cream],
    shortDescription:
      "A pH-balanced gel cleanser with green tea and aloe that removes grime without stripping.",
    description:
      "Calm uses mild amino-acid surfactants instead of sulphates, so skin feels clean but never tight. Green tea polyphenols soothe redness while aloe and glycerin keep the barrier hydrated. It rinses fully without residue, making it a great second cleanse after sunscreen or light makeup.",
    benefits: [
      "Removes oil, sweat and sunscreen gently",
      "Maintains a healthy skin pH of 5.5",
      "Calms visible redness and irritation",
      "Leaves skin comfortable, never squeaky",
    ],
    ingredients: [
      "Coco-Glucoside & Sodium Cocoyl Glycinate",
      "Green Tea Leaf Extract",
      "Aloe Barbadensis Leaf Juice",
      "Glycerin, Allantoin",
    ],
    howToUse: [
      "Wet face with lukewarm water.",
      "Massage a coin-sized amount for 30 seconds.",
      "Rinse well. Use morning and night.",
    ],
    suitableFor: "Oily, combination and sensitive skin",
    rating: 4.6,
    reviews: baseReviews(
      "Finally a cleanser that doesn't leave my cheeks tight. My skin looks calmer within two weeks.",
      "Foams just enough and a little goes a long way. The bottle has lasted me three months.",
    ),
  },
  {
    slug: "barrier-repair-moisturiser",
    name: "Barrier Repair Moisturiser",
    category: "skin-care",
    tagline: "Ceramide day & night cream",
    price: 899,
    mrp: 1199,
    size: "50 g",
    stock: 0,
    images: [cream, cleanser, serum],
    shortDescription:
      "A ceramide-rich cream that restores a compromised barrier and locks in moisture for 24 hours.",
    description:
      "Built around a 3:1:1 ceramide complex with squalane and niacinamide, this cream rebuilds the skin's lipid barrier after active-heavy routines, harsh weather or over-cleansing. The whipped texture melts in without greasiness and sits comfortably under makeup.",
    benefits: [
      "24-hour clinically measured hydration",
      "Strengthens a weakened moisture barrier",
      "Reduces flaking, tightness and stinging",
      "Non-comedogenic, fragrance-free",
    ],
    ingredients: [
      "Ceramide NP, AP & EOP",
      "5% Squalane",
      "3% Niacinamide",
      "Shea Butter, Cholesterol",
    ],
    howToUse: [
      "Apply to damp skin after serum.",
      "Warm a pea-sized amount between fingertips.",
      "Press gently into face and neck, morning and night.",
    ],
    suitableFor: "Dry, dehydrated and sensitised skin",
    rating: 4.8,
    reviews: baseReviews(
      "Rescued my skin after a retinol overdose. The flaking was gone in four days.",
      "Rich but not heavy — I use it in the day too and makeup sits fine over it.",
    ),
  },
  {
    slug: "rooted-hair-growth-oil",
    name: "Rooted Hair Growth Oil",
    category: "hair-care",
    tagline: "Rosemary + bhringraj blend",
    price: 649,
    mrp: 899,
    size: "100 ml",
    stock: 38,
    images: [hairoil, scalp, hairmask],
    shortDescription:
      "A non-greasy pre-wash oil with rosemary and bhringraj that supports thicker, fuller-looking hair.",
    description:
      "Cold-pressed sesame and grapeseed oils carry rosemary, bhringraj and amla extracts to the scalp, where they support circulation and reduce breakage at the root. Unlike traditional heavy oils, Rooted washes out with a single shampoo and leaves no residue.",
    benefits: [
      "Reduces hair fall from breakage in 8 weeks",
      "Nourishes a dry, flaky scalp",
      "Adds softness and shine to lengths",
      "Washes out easily, no heavy residue",
    ],
    ingredients: [
      "Rosemary Essential Oil",
      "Bhringraj & Amla Extract",
      "Cold-Pressed Sesame Oil",
      "Grapeseed & Jojoba Oil",
    ],
    howToUse: [
      "Section dry hair and apply oil along the scalp.",
      "Massage for 5 minutes with fingertips.",
      "Leave for 1–2 hours, then shampoo. Use twice a week.",
    ],
    suitableFor: "All hair types, especially thinning or dry hair",
    rating: 4.7,
    reviews: baseReviews(
      "Three months in and my hairline has visible baby hair. The smell is herbal, not overpowering.",
      "Rinses out with one wash, which no other oil has managed for me.",
    ),
  },
  {
    slug: "everyday-gentle-shampoo",
    name: "Everyday Gentle Shampoo",
    category: "hair-care",
    tagline: "Sulphate-free daily cleanse",
    price: 549,
    mrp: 749,
    size: "250 ml",
    stock: 47,
    images: [shampoo, hairoil, hairmask],
    shortDescription:
      "A colour-safe, sulphate-free shampoo that cleanses without drying out lengths or scalp.",
    description:
      "Formulated for daily use with mild coconut-derived cleansers, hydrolysed rice protein and panthenol. It lifts oil and product build-up while keeping the scalp's natural moisture intact — safe for coloured, keratin-treated and curly hair.",
    benefits: [
      "Cleanses without stripping natural oils",
      "Safe for coloured and treated hair",
      "Reduces frizz and improves manageability",
      "Light, refreshing citrus-mint finish",
    ],
    ingredients: [
      "Sodium Cocoyl Isethionate",
      "Hydrolysed Rice Protein",
      "Panthenol (Pro-Vitamin B5)",
      "Aloe Vera, Peppermint Oil",
    ],
    howToUse: [
      "Wet hair thoroughly.",
      "Work a coin-sized amount into the scalp, not the lengths.",
      "Rinse and follow with conditioner or hair mask.",
    ],
    suitableFor: "All hair types, including coloured and curly hair",
    rating: 4.5,
    reviews: baseReviews(
      "My scalp used to itch by day two — not anymore. Lathers well for a sulphate-free formula.",
      "Hair feels soft straight out of the shower without conditioner.",
    ),
  },
  {
    slug: "deep-repair-hair-mask",
    name: "Deep Repair Hair Mask",
    category: "hair-care",
    tagline: "Weekly protein treatment",
    price: 799,
    mrp: 1049,
    size: "200 g",
    stock: 12,
    images: [hairmask, shampoo, hairoil],
    shortDescription:
      "A once-a-week mask with keratin peptides that rebuilds damaged, over-processed hair.",
    description:
      "Heat, colour and hard water leave hair porous and brittle. This mask combines keratin peptides, murumuru butter and fermented rice water to fill in damaged cuticles, restoring strength and slip in a single 10-minute treatment.",
    benefits: [
      "Repairs split ends and heat damage",
      "Deeply conditions dry, porous hair",
      "Cuts detangling time noticeably",
      "Adds mirror-like shine",
    ],
    ingredients: [
      "Keratin Peptides",
      "Murumuru & Shea Butter",
      "Fermented Rice Water",
      "Argan Oil, Vitamin E",
    ],
    howToUse: [
      "After shampooing, squeeze out excess water.",
      "Apply from mid-length to ends and comb through.",
      "Leave for 10 minutes and rinse. Use once a week.",
    ],
    suitableFor: "Dry, frizzy, coloured or chemically treated hair",
    rating: 4.9,
    reviews: baseReviews(
      "My bleached ends actually feel like hair again. Ten minutes is all it takes.",
      "Thick and creamy — the jar lasts far longer than I expected.",
    ),
  },
  {
    slug: "balance-scalp-tonic",
    name: "Balance Scalp Tonic",
    category: "hair-care",
    tagline: "Leave-in daily scalp mist",
    price: 599,
    size: "100 ml",
    stock: 29,
    images: [scalp, hairoil, shampoo],
    shortDescription:
      "A lightweight leave-in mist with niacinamide and tea tree that soothes itch and flaking.",
    description:
      "A daily scalp mist for anyone who can't oil regularly. Niacinamide, zinc PCA and tea tree calm irritation and regulate oil, while caffeine keeps the scalp feeling fresh. Absorbs instantly with no stickiness or weigh-down.",
    benefits: [
      "Relieves itch and visible flaking",
      "Balances excess oil between washes",
      "Lightweight, no greasy residue",
      "Can be used on styled hair",
    ],
    ingredients: [
      "4% Niacinamide",
      "Zinc PCA",
      "Tea Tree Oil",
      "Caffeine, Witch Hazel",
    ],
    howToUse: [
      "Part dry or damp hair in sections.",
      "Spray directly onto the scalp.",
      "Massage in lightly. Do not rinse. Use daily.",
    ],
    suitableFor: "Oily, itchy or flaky scalps",
    rating: 4.4,
    reviews: baseReviews(
      "Dandruff flakes reduced within two weeks and my hair doesn't feel weighed down.",
      "Great for days I skip washing. Cooling without being harsh.",
    ),
  },
];

export const getProduct = (slug: string) => products.find((p) => p.slug === slug);

export const formatPrice = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);

export const discountPct = (p: Product) =>
  p.mrp ? Math.round(((p.mrp - p.price) / p.mrp) * 100) : 0;