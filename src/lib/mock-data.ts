// Static mock data for the prototype. No backend involved.

export type CustomerStatus = "active" | "inactive" | "new";
export type TxType = "earned" | "redeemed" | "adjustment";

export type BusinessCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  joined: string;
  points: number;
  totalEarned: number;
  visits: number;
  rewards: number;
  lastActivity: string;
  status: CustomerStatus;
};

export type Transaction = {
  id: string;
  date: string;
  customer: string;
  type: TxType;
  points: number;
  description: string;
  status: "completed" | "pending";
};

export type Reward = {
  id: string;
  name: string;
  description: string;
  icon: string;
  points: number;
  active: boolean;
  redeemed: number;
};

export const business = {
  name: "Bloom Café",
  category: "Café",
  email: "hello@bloomcafe.co",
  phone: "+33 6 12 45 88 02",
  address: "14 Rue des Lilas, 75011 Paris",
  programName: "Bloom Café Rewards",
  joinLink: "https://loyal.app/join/bloom-cafe",
};

export const businessStats = [
  { label: "Total Customers", value: "1,284", delta: "+8.2%", trend: "up" as const },
  { label: "Active Customers", value: "846", delta: "+4.1%", trend: "up" as const },
  { label: "Points Issued", value: "12,450", delta: "+12.6%", trend: "up" as const },
  { label: "Rewards Redeemed", value: "186", delta: "-2.3%", trend: "down" as const },
];

export const weeklyActivity = [
  { day: "Mon", visits: 118, points: 940 },
  { day: "Tue", visits: 142, points: 1120 },
  { day: "Wed", visits: 131, points: 1015 },
  { day: "Thu", visits: 167, points: 1340 },
  { day: "Fri", visits: 204, points: 1720 },
  { day: "Sat", visits: 246, points: 2080 },
  { day: "Sun", visits: 173, points: 1390 },
];

export const growthSeries = [
  { month: "Apr", customers: 612, issued: 6400, redeemed: 1800 },
  { month: "May", customers: 704, issued: 7250, redeemed: 2100 },
  { month: "Jun", customers: 812, issued: 8320, redeemed: 2480 },
  { month: "Jul", customers: 934, issued: 9610, redeemed: 2960 },
  { month: "Aug", customers: 1092, issued: 10880, redeemed: 3320 },
  { month: "Sep", customers: 1284, issued: 12450, redeemed: 3840 },
];

export const redemptionMix = [
  { reward: "Free Coffee", count: 96 },
  { reward: "Free Pastry", count: 54 },
  { reward: "€5 Discount", count: 24 },
  { reward: "Birthday Treat", count: 12 },
];

export const recentActivity = [
  { id: "a1", name: "Sarah Meyer", action: "earned 20 points", time: "2 minutes ago", type: "earned" },
  { id: "a2", name: "Ahmed Belkacem", action: 'redeemed "Free Coffee"', time: "18 minutes ago", type: "redeemed" },
  { id: "a3", name: "Lina Roux", action: "joined your loyalty program", time: "32 minutes ago", type: "joined" },
  { id: "a4", name: "Yasmine Haddad", action: "earned 15 points", time: "1 hour ago", type: "earned" },
  { id: "a5", name: "Tom Keller", action: "earned 40 points", time: "2 hours ago", type: "earned" },
  { id: "a6", name: "Claire Dubois", action: 'redeemed "Free Pastry"', time: "3 hours ago", type: "redeemed" },
];

export const customers: BusinessCustomer[] = [
  {
    id: "c1",
    name: "Sarah Meyer",
    email: "sarah.meyer@mail.com",
    phone: "+33 6 22 10 44 81",
    joined: "12 Mar 2026",
    points: 320,
    totalEarned: 1240,
    visits: 48,
    rewards: 7,
    lastActivity: "2 minutes ago",
    status: "active",
  },
  {
    id: "c2",
    name: "Ahmed Belkacem",
    email: "a.belkacem@mail.com",
    phone: "+33 7 88 21 09 33",
    joined: "04 Jan 2026",
    points: 145,
    totalEarned: 980,
    visits: 36,
    rewards: 5,
    lastActivity: "18 minutes ago",
    status: "active",
  },
  {
    id: "c3",
    name: "Lina Roux",
    email: "lina.roux@mail.com",
    phone: "+33 6 74 55 12 90",
    joined: "26 Sep 2026",
    points: 20,
    totalEarned: 20,
    visits: 1,
    rewards: 0,
    lastActivity: "32 minutes ago",
    status: "new",
  },
  {
    id: "c4",
    name: "Yasmine Haddad",
    email: "yasmine.h@mail.com",
    phone: "+33 6 10 77 65 21",
    joined: "19 Feb 2026",
    points: 210,
    totalEarned: 760,
    visits: 29,
    rewards: 3,
    lastActivity: "1 hour ago",
    status: "active",
  },
  {
    id: "c5",
    name: "Tom Keller",
    email: "tom.keller@mail.com",
    phone: "+33 7 45 33 18 07",
    joined: "08 Dec 2025",
    points: 480,
    totalEarned: 2150,
    visits: 71,
    rewards: 12,
    lastActivity: "2 hours ago",
    status: "active",
  },
  {
    id: "c6",
    name: "Claire Dubois",
    email: "claire.dubois@mail.com",
    phone: "+33 6 98 41 23 66",
    joined: "15 Nov 2025",
    points: 85,
    totalEarned: 1420,
    visits: 52,
    rewards: 9,
    lastActivity: "3 hours ago",
    status: "active",
  },
  {
    id: "c7",
    name: "Marc Lefèvre",
    email: "marc.lefevre@mail.com",
    phone: "+33 6 31 09 77 12",
    joined: "02 Aug 2025",
    points: 40,
    totalEarned: 640,
    visits: 18,
    rewards: 2,
    lastActivity: "4 months ago",
    status: "inactive",
  },
  {
    id: "c8",
    name: "Nour Bensalem",
    email: "nour.bensalem@mail.com",
    phone: "+33 7 12 66 80 45",
    joined: "21 Sep 2026",
    points: 60,
    totalEarned: 60,
    visits: 3,
    rewards: 0,
    lastActivity: "Yesterday",
    status: "new",
  },
  {
    id: "c9",
    name: "Julien Barré",
    email: "julien.barre@mail.com",
    phone: "+33 6 55 02 19 74",
    joined: "11 Jun 2025",
    points: 15,
    totalEarned: 410,
    visits: 12,
    rewards: 1,
    lastActivity: "6 months ago",
    status: "inactive",
  },
  {
    id: "c10",
    name: "Emma Petit",
    email: "emma.petit@mail.com",
    phone: "+33 6 87 34 55 29",
    joined: "30 Apr 2026",
    points: 265,
    totalEarned: 890,
    visits: 33,
    rewards: 4,
    lastActivity: "Today",
    status: "active",
  },
];

export const transactions: Transaction[] = [
  { id: "t1", date: "26 Sep 2026 · 18:42", customer: "Sarah Meyer", type: "earned", points: 20, description: "Purchase €20.00", status: "completed" },
  { id: "t2", date: "26 Sep 2026 · 18:26", customer: "Ahmed Belkacem", type: "redeemed", points: -100, description: "Free Coffee", status: "completed" },
  { id: "t3", date: "26 Sep 2026 · 18:12", customer: "Lina Roux", type: "earned", points: 20, description: "Welcome bonus", status: "completed" },
  { id: "t4", date: "26 Sep 2026 · 17:40", customer: "Yasmine Haddad", type: "earned", points: 15, description: "Purchase €15.00", status: "completed" },
  { id: "t5", date: "26 Sep 2026 · 16:55", customer: "Tom Keller", type: "adjustment", points: 25, description: "Service recovery", status: "completed" },
  { id: "t6", date: "26 Sep 2026 · 15:31", customer: "Claire Dubois", type: "redeemed", points: -150, description: "Free Pastry", status: "completed" },
  { id: "t7", date: "26 Sep 2026 · 14:08", customer: "Emma Petit", type: "earned", points: 32, description: "Purchase €32.00", status: "completed" },
  { id: "t8", date: "26 Sep 2026 · 12:47", customer: "Nour Bensalem", type: "earned", points: 12, description: "Purchase €12.00", status: "completed" },
  { id: "t9", date: "25 Sep 2026 · 19:20", customer: "Sarah Meyer", type: "redeemed", points: -250, description: "€5 Discount", status: "completed" },
  { id: "t10", date: "25 Sep 2026 · 17:02", customer: "Marc Lefèvre", type: "adjustment", points: -10, description: "Duplicate scan correction", status: "completed" },
  { id: "t11", date: "25 Sep 2026 · 11:15", customer: "Tom Keller", type: "earned", points: 48, description: "Purchase €48.00", status: "completed" },
  { id: "t12", date: "24 Sep 2026 · 09:38", customer: "Claire Dubois", type: "earned", points: 18, description: "Purchase €18.00", status: "pending" },
];

export const rewards: Reward[] = [
  { id: "r1", name: "Free Coffee", description: "Any hot coffee of your choice.", icon: "coffee", points: 100, active: true, redeemed: 96 },
  { id: "r2", name: "Free Pastry", description: "One pastry from the morning counter.", icon: "croissant", points: 150, active: true, redeemed: 54 },
  { id: "r3", name: "€5 Discount", description: "€5 off your next order.", icon: "ticket", points: 250, active: true, redeemed: 24 },
  { id: "r4", name: "Birthday Treat", description: "A free slice of cake on your birthday.", icon: "cake", points: 0, active: false, redeemed: 12 },
];

export const staff = [
  { id: "s1", name: "Camille Fontaine", role: "Owner", email: "camille@bloomcafe.co" },
  { id: "s2", name: "Hugo Martin", role: "Manager", email: "hugo@bloomcafe.co" },
  { id: "s3", name: "Inès Cherif", role: "Staff", email: "ines@bloomcafe.co" },
];

/* ---------------------------------- Customer --------------------------------- */

export type Membership = {
  id: string;
  business: string;
  category: string;
  points: number;
  nextReward: string;
  nextRewardAt: number;
  color: string;
  initials: string;
  visits: number;
  joined: string;
};

export const customerProfile = {
  name: "Sarah Meyer",
  email: "sarah.meyer@mail.com",
  phone: "+33 6 22 10 44 81",
  memberSince: "March 2026",
  initials: "SM",
};

export const memberships: Membership[] = [
  { id: "m1", business: "Bloom Café", category: "Café", points: 120, nextReward: "Free Coffee", nextRewardAt: 100, color: "var(--color-primary)", initials: "BC", visits: 48, joined: "12 Mar 2026" },
  { id: "m2", business: "Lume Beauty Salon", category: "Salon", points: 80, nextReward: "Free Blow-dry", nextRewardAt: 200, color: "var(--color-brand-amber)", initials: "LB", visits: 12, joined: "04 May 2026" },
  { id: "m3", business: "Napoli Pizza House", category: "Restaurant", points: 250, nextReward: "Free Pizza", nextRewardAt: 300, color: "var(--color-chart-3)", initials: "NP", visits: 27, joined: "18 Jan 2026" },
  { id: "m4", business: "Green Grocer", category: "Grocery", points: 45, nextReward: "€3 Basket Discount", nextRewardAt: 150, color: "var(--color-chart-4)", initials: "GG", visits: 9, joined: "02 Aug 2026" },
];

export const customerRewards = [
  { id: "cr1", business: "Bloom Café", name: "Free Coffee", points: 100, ready: true, expires: "Expires 31 Oct 2026" },
  { id: "cr2", business: "Napoli Pizza House", name: "Garlic Bread", points: 120, ready: true, expires: "Expires 15 Nov 2026" },
  { id: "cr3", business: "Bloom Café", name: "Free Pastry", points: 150, ready: false, expires: "30 points to go" },
  { id: "cr4", business: "Lume Beauty Salon", name: "Free Blow-dry", points: 200, ready: false, expires: "120 points to go" },
];

export const customerActivity = [
  { id: "ca1", business: "Bloom Café", action: "Earned 20 points", detail: "Purchase €20.00", time: "2 minutes ago", positive: true },
  { id: "ca2", business: "Napoli Pizza House", action: "Earned 35 points", detail: "Purchase €35.00", time: "Yesterday", positive: true },
  { id: "ca3", business: "Bloom Café", action: "Redeemed Free Coffee", detail: "-100 points", time: "3 days ago", positive: false },
  { id: "ca4", business: "Lume Beauty Salon", action: "Earned 40 points", detail: "Purchase €40.00", time: "1 week ago", positive: true },
  { id: "ca5", business: "Green Grocer", action: "Joined loyalty program", detail: "Welcome bonus +10", time: "2 weeks ago", positive: true },
];

export const nearbyBusinesses = [
  { id: "nb1", name: "Atelier Bagel", category: "Bakery", distance: "240 m", perk: "10 stamps = free bagel", initials: "AB" },
  { id: "nb2", name: "Vinyl & Brew", category: "Coffee bar", distance: "500 m", perk: "€1 = 1 point", initials: "VB" },
  { id: "nb3", name: "Studio Pilates 11", category: "Fitness", distance: "800 m", perk: "8 classes = 1 free", initials: "SP" },
  { id: "nb4", name: "Fleur & Co", category: "Florist", distance: "1.2 km", perk: "€1 = 2 points", initials: "FC" },
];

/* ----------------------------------- Admin ----------------------------------- */

export const adminStats = [
  { label: "Businesses", value: "342", delta: "+18 this month", trend: "up" as const },
  { label: "Customers", value: "48,920", delta: "+6.4%", trend: "up" as const },
  { label: "Points Issued", value: "3.2M", delta: "+11.8%", trend: "up" as const },
  { label: "Monthly Revenue", value: "€24,180", delta: "+9.1%", trend: "up" as const },
];

export const adminGrowth = [
  { month: "Apr", businesses: 212, customers: 28400 },
  { month: "May", businesses: 238, customers: 32100 },
  { month: "Jun", businesses: 261, customers: 36050 },
  { month: "Jul", businesses: 287, customers: 39840 },
  { month: "Aug", businesses: 316, customers: 44210 },
  { month: "Sep", businesses: 342, customers: 48920 },
];

export type AdminBusiness = {
  id: string;
  name: string;
  category: string;
  owner: string;
  customers: number;
  plan: "Starter" | "Growth" | "Pro";
  status: "active" | "pending" | "suspended";
  joined: string;
};

export const adminBusinesses: AdminBusiness[] = [
  { id: "b1", name: "Bloom Café", category: "Café", owner: "Camille Fontaine", customers: 1284, plan: "Growth", status: "active", joined: "12 Nov 2025" },
  { id: "b2", name: "Napoli Pizza House", category: "Restaurant", owner: "Marco Rossi", customers: 2140, plan: "Pro", status: "active", joined: "03 Sep 2025" },
  { id: "b3", name: "Lume Beauty Salon", category: "Salon", owner: "Aïcha Benali", customers: 612, plan: "Starter", status: "active", joined: "27 Jan 2026" },
  { id: "b4", name: "Green Grocer", category: "Grocery", owner: "Paul Simon", customers: 388, plan: "Starter", status: "pending", joined: "22 Sep 2026" },
  { id: "b5", name: "Atelier Bagel", category: "Bakery", owner: "Sofia Lind", customers: 745, plan: "Growth", status: "active", joined: "14 Apr 2026" },
  { id: "b6", name: "Vinyl & Brew", category: "Coffee bar", owner: "Léo Garnier", customers: 269, plan: "Starter", status: "suspended", joined: "08 Feb 2026" },
  { id: "b7", name: "Studio Pilates 11", category: "Fitness", owner: "Nadia Kaci", customers: 431, plan: "Growth", status: "active", joined: "19 Jun 2026" },
  { id: "b8", name: "Fleur & Co", category: "Florist", owner: "Chloé Mercier", customers: 156, plan: "Starter", status: "pending", joined: "25 Sep 2026" },
];

export const adminCustomers = [
  { id: "ac1", name: "Sarah Meyer", email: "sarah.meyer@mail.com", memberships: 4, points: 495, joined: "12 Mar 2026", status: "active" },
  { id: "ac2", name: "Tom Keller", email: "tom.keller@mail.com", memberships: 6, points: 1320, joined: "08 Dec 2025", status: "active" },
  { id: "ac3", name: "Nour Bensalem", email: "nour.bensalem@mail.com", memberships: 2, points: 140, joined: "21 Sep 2026", status: "new" },
  { id: "ac4", name: "Marc Lefèvre", email: "marc.lefevre@mail.com", memberships: 1, points: 40, joined: "02 Aug 2025", status: "inactive" },
  { id: "ac5", name: "Emma Petit", email: "emma.petit@mail.com", memberships: 3, points: 610, joined: "30 Apr 2026", status: "active" },
  { id: "ac6", name: "Ahmed Belkacem", email: "a.belkacem@mail.com", memberships: 5, points: 880, joined: "04 Jan 2026", status: "active" },
];

export const adminActivity = [
  { id: "aa1", title: "Fleur & Co applied to join", detail: "Florist · Paris 11", time: "12 minutes ago", kind: "pending" },
  { id: "aa2", title: "Napoli Pizza House upgraded to Pro", detail: "€79 / month", time: "1 hour ago", kind: "billing" },
  { id: "aa3", title: "Vinyl & Brew suspended", detail: "Payment failed twice", time: "4 hours ago", kind: "warning" },
  { id: "aa4", title: "Atelier Bagel passed 700 customers", detail: "Growth plan", time: "Yesterday", kind: "success" },
  { id: "aa5", title: "Green Grocer applied to join", detail: "Grocery · Paris 20", time: "2 days ago", kind: "pending" },
];
