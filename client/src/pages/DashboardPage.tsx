import { useAuth } from "@/_core/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, CalendarClock, CreditCard, Loader2, RefreshCw, TrendingUp } from "lucide-react";
import { Link } from "wouter";

export default function DashboardPage() {
  const { user, isAuthenticated, loading } = useAuth({ redirectOnUnauthenticated: true, redirectPath: "/" });
  const utils = trpc.useUtils();

  const { data: userBookings = [], isLoading: isLoadingUserBookings, refetch: refetchUserBookings } = trpc.bookings.getUserBookings.useQuery(undefined, {
    enabled: isAuthenticated && user?.role !== "admin",
  });

  const { data: adminBookings = [], isLoading: isLoadingAdminBookings, refetch: refetchAdminBookings } = trpc.bookings.getAdminBookings.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });

  const refundMutation = trpc.bookings.requestRefund.useMutation({
    onSuccess: async () => {
      await utils.bookings.getUserBookings.invalidate();
      await utils.bookings.getAdminBookings.invalidate();
      await refetchUserBookings();
      await refetchAdminBookings();
    },
  });

  const rescheduleMutation = trpc.bookings.rescheduleBooking.useMutation({
    onSuccess: async () => {
      await utils.bookings.getUserBookings.invalidate();
      await utils.bookings.getAdminBookings.invalidate();
      await refetchUserBookings();
      await refetchAdminBookings();
    },
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const isAdmin = user.role === "admin";
  const bookings = isAdmin ? adminBookings : userBookings;
  const isLoading = isAdmin ? isLoadingAdminBookings : isLoadingUserBookings;

  const totalRevenue = bookings.reduce((acc, booking) => acc + Number(booking.amount || 0), 0);
  const confirmedCount = bookings.filter(booking => booking.status === "confirmed").length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-black/20 backdrop-blur">
        <div className="container py-6 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-primary">Painel</p>
            <h1 className="text-2xl font-semibold">
              {isAdmin ? "Dashboard administrativa" : "Meus agendamentos"}
            </h1>
          </div>
          <Button variant="outline" asChild>
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao início
            </Link>
          </Button>
        </div>
      </header>

      <main className="container py-8 space-y-6">
        <div className={`grid gap-4 ${isAdmin ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <Card className="p-5">
            <div className="flex items-center gap-3 text-primary">
              <CalendarClock className="h-5 w-5" />
              <span className="font-medium">Agendamentos</span>
            </div>
            <p className="mt-4 text-3xl font-semibold">{bookings.length}</p>
            <p className="text-sm text-muted-foreground">
              {isAdmin ? "Total de compromissos cadastrados" : "Seus compromissos"}
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-3 text-primary">
              <TrendingUp className="h-5 w-5" />
              <span className="font-medium">Confirmados</span>
            </div>
            <p className="mt-4 text-3xl font-semibold">{confirmedCount}</p>
            <p className="text-sm text-muted-foreground">Serviços já aprovados</p>
          </Card>

          {isAdmin ? (
            <Card className="p-5">
              <div className="flex items-center gap-3 text-primary">
                <CreditCard className="h-5 w-5" />
                <span className="font-medium">Faturamento</span>
              </div>
              <p className="mt-4 text-3xl font-semibold">R$ {(totalRevenue / 100).toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">Somatório de todos os serviços</p>
            </Card>
          ) : null}
        </div>

        {isAdmin ? (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Agenda e faturamento</h2>
                <p className="text-sm text-muted-foreground">Visualize todos os clientes, status e receitas</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { void refetchAdminBookings(); }}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </div>

            <div className="mt-6 space-y-3">
              {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando agenda...
                </div>
              ) : bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum agendamento encontrado.</p>
              ) : (
                bookings.map(booking => (
                  <div key={booking.id} className="rounded-xl border border-border/70 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{booking.clientName}</h3>
                        <Badge variant={booking.status === "confirmed" ? "default" : booking.status === "cancelled" ? "secondary" : "outline"}>
                          {booking.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{booking.clientEmail}</p>
                      <p className="text-sm text-muted-foreground">{new Date(booking.bookingTime).toLocaleString("pt-BR")}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">R$ {(Number(booking.amount || 0) / 100).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">{booking.clientPhone}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Seus serviços</h2>
                <p className="text-sm text-muted-foreground">Gerencie reembolso e remarcação</p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { void refetchUserBookings(); }}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Atualizar
              </Button>
            </div>

            <div className="mt-6 space-y-3">
              {isLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando agendamentos...
                </div>
              ) : bookings.length === 0 ? (
                <p className="text-sm text-muted-foreground">Você ainda não possui agendamentos.</p>
              ) : (
                bookings.map(booking => (
                  <div key={booking.id} className="rounded-xl border border-border/70 p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{new Date(booking.bookingTime).toLocaleString("pt-BR")}</h3>
                        <Badge variant={booking.status === "confirmed" ? "default" : booking.status === "cancelled" ? "secondary" : "outline"}>
                          {booking.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Valor: R$ {(Number(booking.amount || 0) / 100).toFixed(2)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const nextTime = window.prompt("Informe a nova data e hora (ex.: 2026-07-20T15:00:00)", new Date(booking.bookingTime).toISOString());
                          if (!nextTime) return;
                          rescheduleMutation.mutate({ bookingId: booking.id, bookingTime: nextTime });
                        }}
                      >
                        Remarcar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => refundMutation.mutate({ bookingId: booking.id })}
                      >
                        Solicitar reembolso
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
