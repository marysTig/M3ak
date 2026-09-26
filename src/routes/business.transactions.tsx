import { createFileRoute } from "@tanstack/react-router";
import { Plus, Receipt, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/app/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { customers, transactions as seed, type Transaction } from "@/lib/mock-data";

export const Route = createFileRoute("/business/transactions")({
  head: () => ({
    meta: [
      { title: "Transactions — Bloom Café Loyalty" },
      {
        name: "description",
        content: "Log points earned, redeemed and adjusted for your loyalty customers.",
      },
      { property: "og:title", content: "Transactions — Bloom Café Loyalty" },
      {
        property: "og:description",
        content: "Log points earned, redeemed and adjusted for your loyalty customers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TransactionsPage,
});

const filters = [
  { id: "all", label: "All" },
  { id: "earned", label: "Earned" },
  { id: "redeemed", label: "Redeemed" },
  { id: "adjustment", label: "Adjustments" },
] as const;

function TransactionsPage() {
  const [rows, setRows] = useState<Transaction[]>(seed);
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ customer: "", points: "", reason: "" });

  const visible = useMemo(
    () =>
      rows.filter((t) => {
        const matchesType = filter === "all" || t.type === filter;
        const q = query.trim().toLowerCase();
        return matchesType && (!q || t.customer.toLowerCase().includes(q));
      }),
    [rows, filter, query],
  );

  function submit() {
    if (!form.customer || !form.points) {
      toast.error("Pick a customer and a points amount.");
      return;
    }
    const tx: Transaction = {
      id: `t${Date.now()}`,
      date: "Just now",
      customer: form.customer,
      type: "earned",
      points: Number(form.points),
      description: form.reason || "Manual entry",
      status: "completed",
    };
    setRows([tx, ...rows]);
    setOpen(false);
    setForm({ customer: "", points: "", reason: "" });
    toast.success(`${tx.points} points added to ${tx.customer}`);
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        subtitle="Every point earned, redeemed or adjusted."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> Add Points
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add points</DialogTitle>
                <DialogDescription>Reward a customer for a purchase or visit.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select
                    value={form.customer}
                    onValueChange={(v) => setForm({ ...form, customer: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="points">Points</Label>
                  <Input
                    id="points"
                    inputMode="numeric"
                    placeholder="20"
                    value={form.points}
                    onChange={(e) => setForm({ ...form, points: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Input
                    id="reason"
                    placeholder="Purchase €20.00"
                    value={form.reason}
                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={submit}>Add Points</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="card-surface overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by customer..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList>
              {filters.map((f) => (
                <TabsTrigger key={f.id} value={f.id}>
                  {f.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Receipt}
              title="No transactions"
              description="Nothing matches this filter yet."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="hidden md:table-cell">Description</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {t.date}
                    </TableCell>
                    <TableCell className="font-medium">{t.customer}</TableCell>
                    <TableCell>
                      <StatusBadge status={t.type} />
                    </TableCell>
                    <TableCell
                      className={
                        t.points >= 0
                          ? "text-right font-medium text-success"
                          : "text-right font-medium text-destructive"
                      }
                    >
                      {t.points > 0 ? `+${t.points}` : t.points}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {t.description}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={t.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
