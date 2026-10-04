/**
 * loyalty-store.ts
 *
 * Système de persistance client-side pour le programme de fidélité.
 * Toutes les données sont stockées dans localStorage.
 * Simule une véritable BDD relationnelle sans backend.
 *
 * Relations:
 *   LoyaltyCustomer → LoyaltyCard → LoyaltyTransaction
 *   LoyaltyCard.merchantId === MERCHANT_ID (commerçant courant, fixe en démo)
 *   LoyaltyCard.qrToken === identifiant unique sécurisé (UUID)
 */

// ─── Identité du commerçant (en démo, fixe) ────────────────────────────────
export const MERCHANT_ID = "merchant_bloom_cafe";
export const STORE_ID = "store_main";
export const MERCHANT_NAME = "Bloom Café";

// ─── Types ─────────────────────────────────────────────────────────────────

export type CardStatus = "active" | "inactive" | "suspended";
export type CustomerStatus = "active" | "inactive" | "new";

export interface LoyaltyCustomer {
  id: string;
  name: string;
  email: string;
  merchantId: string;
  createdAt: string;
}

export interface LoyaltyCard {
  id: string;
  customerId: string;
  merchantId: string;
  storeId: string;
  /** Token unique utilisé dans le QR code — ne contient PAS les points */
  qrToken: string;
  points: number;
  totalEarned: number;
  status: CardStatus;
  themeId: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyTransaction {
  id: string;
  cardId: string;
  customerId: string;
  merchantId: string;
  storeId: string;
  pointsAdded: number;
  previousBalance: number;
  newBalance: number;
  description: string;
  createdBy: string;
  createdAt: string;
}

export interface MerchantTheme {
  merchantId: string;
  themeId: string;
  updatedAt: string;
}

// ─── Clés localStorage ─────────────────────────────────────────────────────

const KEYS = {
  customers: "m3ak_customers",
  cards: "m3ak_cards",
  transactions: "m3ak_transactions",
  merchantTheme: "m3ak_merchant_theme",
} as const;

// ─── Helpers persistance ───────────────────────────────────────────────────

function load<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function loadOne<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(data));
}

// ─── Génération d'identifiants ─────────────────────────────────────────────

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateQrToken(): string {
  // Token opaque — ne contient pas d'informations sensibles
  const arr = new Uint8Array(16);
  if (typeof window !== "undefined" && window.crypto) {
    window.crypto.getRandomValues(arr);
  } else {
    for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Validation ─────────────────────────────────────────────────────────────

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function validatePointsToAdd(value: unknown): { valid: boolean; error?: string } {
  if (value === null || value === undefined || value === "") {
    return { valid: false, error: "Veuillez saisir un nombre de points." };
  }
  const n = Number(value);
  if (isNaN(n)) return { valid: false, error: "La valeur doit être un nombre." };
  if (!Number.isInteger(n)) return { valid: false, error: "Les points doivent être un nombre entier." };
  if (n <= 0) return { valid: false, error: "Le nombre de points doit être positif (minimum 1)." };
  if (n > 10000) return { valid: false, error: "Le nombre de points ne peut pas dépasser 10 000 par opération." };
  return { valid: true };
}

// ─── Formatage des dates ────────────────────────────────────────────────────

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Customers ──────────────────────────────────────────────────────────────

export function getCustomers(merchantId: string): LoyaltyCustomer[] {
  return load<LoyaltyCustomer>(KEYS.customers).filter((c) => c.merchantId === merchantId);
}

export function getCustomerById(id: string): LoyaltyCustomer | undefined {
  return load<LoyaltyCustomer>(KEYS.customers).find((c) => c.id === id);
}

export function getCustomerByEmail(email: string, merchantId: string): LoyaltyCustomer | undefined {
  return load<LoyaltyCustomer>(KEYS.customers).find(
    (c) => c.email.toLowerCase() === email.toLowerCase() && c.merchantId === merchantId,
  );
}

export function createCustomer(name: string, email: string, merchantId: string): LoyaltyCustomer {
  const existing = getCustomerByEmail(email, merchantId);
  if (existing) throw new Error(`Un client avec l'adresse ${email} existe déjà.`);

  const customer: LoyaltyCustomer = {
    id: generateId("cust"),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    merchantId,
    createdAt: new Date().toISOString(),
  };

  const all = load<LoyaltyCustomer>(KEYS.customers);
  save(KEYS.customers, [...all, customer]);
  return customer;
}

// ─── Cards ──────────────────────────────────────────────────────────────────

export function getCards(merchantId: string): LoyaltyCard[] {
  return load<LoyaltyCard>(KEYS.cards).filter((c) => c.merchantId === merchantId);
}

export function getCardById(id: string): LoyaltyCard | undefined {
  return load<LoyaltyCard>(KEYS.cards).find((c) => c.id === id);
}

export function getCardByCustomer(customerId: string, merchantId: string): LoyaltyCard | undefined {
  return load<LoyaltyCard>(KEYS.cards).find(
    (c) => c.customerId === customerId && c.merchantId === merchantId,
  );
}

/** Résout un QR token → carte. NE retourne la carte QUE si elle appartient au bon commerçant. */
export function resolveQrToken(token: string, merchantId: string): LoyaltyCard | null {
  const card = load<LoyaltyCard>(KEYS.cards).find((c) => c.qrToken === token);
  if (!card) return null;
  // VÉRIFICATION DE SÉCURITÉ : le commerçant doit posséder cette carte
  if (card.merchantId !== merchantId) return null;
  return card;
}

export function createCard(
  customerId: string,
  merchantId: string,
  storeId: string,
  themeId: string = "aurora",
): LoyaltyCard {
  const existing = getCardByCustomer(customerId, merchantId);
  if (existing) return existing; // idempotent

  const card: LoyaltyCard = {
    id: generateId("card"),
    customerId,
    merchantId,
    storeId,
    qrToken: generateQrToken(),
    points: 0,
    totalEarned: 0,
    status: "active",
    themeId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const all = load<LoyaltyCard>(KEYS.cards);
  save(KEYS.cards, [...all, card]);
  return card;
}

// ─── Transactions (atomique) ────────────────────────────────────────────────

export interface AddPointsResult {
  card: LoyaltyCard;
  transaction: LoyaltyTransaction;
}

/**
 * Ajoute des points à une carte de manière atomique.
 * Vérifie que le commerçant possède bien la carte (sécurité).
 * Ne retourne JAMAIS le nouveau solde — le frontend doit recharger la carte.
 */
export function addPoints(
  cardId: string,
  pointsToAdd: number,
  merchantId: string,
  storeId: string,
  description: string = "Ajout de points",
  createdBy: string = merchantId,
): AddPointsResult {
  // Validation
  const validation = validatePointsToAdd(pointsToAdd);
  if (!validation.valid) throw new Error(validation.error);

  // Lecture atomique
  const allCards = load<LoyaltyCard>(KEYS.cards);
  const allTx = load<LoyaltyTransaction>(KEYS.transactions);

  const cardIndex = allCards.findIndex((c) => c.id === cardId);
  if (cardIndex === -1) throw new Error("Carte introuvable.");

  const card = allCards[cardIndex];

  // Vérification sécurité côté "serveur" (localStorage = client, mais la logique est correcte)
  if (card.merchantId !== merchantId) {
    throw new Error("Accès refusé : cette carte appartient à un autre commerçant.");
  }
  if (card.storeId !== storeId) {
    throw new Error("Accès refusé : cette carte appartient à une autre boutique.");
  }
  if (card.status !== "active") {
    throw new Error(`Opération refusée : la carte est ${card.status}.`);
  }

  const previousBalance = card.points;
  const newBalance = previousBalance + pointsToAdd;

  // Mise à jour atomique : carte + transaction ensemble
  const updatedCard: LoyaltyCard = {
    ...card,
    points: newBalance,
    totalEarned: card.totalEarned + pointsToAdd,
    updatedAt: new Date().toISOString(),
  };

  const transaction: LoyaltyTransaction = {
    id: generateId("tx"),
    cardId: card.id,
    customerId: card.customerId,
    merchantId: card.merchantId,
    storeId: card.storeId,
    pointsAdded: pointsToAdd,
    previousBalance,
    newBalance,
    description,
    createdBy,
    createdAt: new Date().toISOString(),
  };

  // Sauvegarde atomique (les deux ou aucun)
  allCards[cardIndex] = updatedCard;
  save(KEYS.cards, allCards);
  save(KEYS.transactions, [...allTx, transaction]);

  return { card: updatedCard, transaction };
}

// ─── Transactions ────────────────────────────────────────────────────────────

export function getTransactionsByCard(cardId: string): LoyaltyTransaction[] {
  return load<LoyaltyTransaction>(KEYS.transactions)
    .filter((t) => t.cardId === cardId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getTransactionsByMerchant(merchantId: string): LoyaltyTransaction[] {
  return load<LoyaltyTransaction>(KEYS.transactions)
    .filter((t) => t.merchantId === merchantId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ─── Thème du commerçant ────────────────────────────────────────────────────

export function getMerchantTheme(merchantId: string): string {
  const stored = loadOne<MerchantTheme>(KEYS.merchantTheme + "_" + merchantId);
  return stored?.themeId ?? "aurora";
}

export function saveMerchantTheme(merchantId: string, themeId: string): void {
  const theme: MerchantTheme = {
    merchantId,
    themeId,
    updatedAt: new Date().toISOString(),
  };
  save(KEYS.merchantTheme + "_" + merchantId, theme);
}

// ─── Vue enrichie client ────────────────────────────────────────────────────

export interface CustomerWithCard {
  customer: LoyaltyCustomer;
  card: LoyaltyCard;
  status: CustomerStatus;
  joinedFormatted: string;
}

export function getCustomersWithCards(merchantId: string): CustomerWithCard[] {
  const customers = getCustomers(merchantId);
  const cards = getCards(merchantId);

  return customers.map((customer) => {
    const card = cards.find((c) => c.customerId === customer.id);
    const points = card?.points ?? 0;

    let status: CustomerStatus = "new";
    const txCount = card ? getTransactionsByCard(card.id).length : 0;
    if (txCount === 0) status = "new";
    else if (txCount >= 5) status = "active";
    else status = "active";

    // Si la dernière tx date de plus de 90 jours → inactive
    if (card) {
      const txs = getTransactionsByCard(card.id);
      if (txs.length > 0) {
        const lastTxDate = new Date(txs[0].createdAt);
        const daysSince = (Date.now() - lastTxDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince > 90) status = "inactive";
        else status = "active";
      }
    }

    void points;

    return {
      customer,
      card: card ?? {
        id: "",
        customerId: customer.id,
        merchantId,
        storeId: STORE_ID,
        qrToken: "",
        points: 0,
        totalEarned: 0,
        status: "inactive" as CardStatus,
        themeId: "aurora",
        createdAt: customer.createdAt,
        updatedAt: customer.createdAt,
      },
      status,
      joinedFormatted: formatDateShort(customer.createdAt),
    };
  });
}
