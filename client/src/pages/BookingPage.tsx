import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Calendar,
  Clock,
  Scissors,
  ArrowLeft,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Link } from "wouter";
import {
  BOOKING_SERVICES,
  formatBRL,
  getBookingServiceById,
} from "@shared/bookingServices";

interface BookingPageProps {
  practitionerId: string;
}

function getDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function formatDayLabel(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

// UUID validation regex
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function BookingPage({ practitionerId }: BookingPageProps) {
  const [, navigate] = useLocation();
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
  });
  const [selectedServiceId, setSelectedServiceId] = useState(BOOKING_SERVICES[0].id);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValidUUID = UUID_REGEX.test(practitionerId);
  const isNumericId = /^\d+$/.test(practitionerId);

  if (isNumericId || !isValidUUID) {
    return (
      <div className="min-h-screen hero-barber flex items-center justify-center px-4">
        <Card className="card-barber p-6 max-w-md w-full">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-gradient">
              <Scissors className="h-6 w-6 text-black" />
            </div>
            <h2 className="text-xl font-semibold text-primary mb-2">
              ID de barbeiro inválido
            </h2>
            <p className="text-muted-foreground mb-4">
              O formato do ID mudou. Selecione um barbeiro na página inicial.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              ID recebido: {practitionerId}
            </p>
            <Button onClick={() => navigate("/")} className="w-full btn-barber border-0">
              Voltar ao início
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const {
    data: availabilityData,
    isLoading,
    error,
  } = trpc.bookings.getAvailability.useQuery(
    { practitionerId },
    {
      enabled: !!practitionerId,
      onSuccess: data => console.log("Availability data received:", data),
      onError: error => {
        console.error("Availability query error:", error);
      },
      retry: false,
    }
  );

  const finalAvailabilityData = availabilityData;

  const handleSlotSelect = (slotId: string) => {
    setSelectedSlot(slotId);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const selectedService = getBookingServiceById(selectedServiceId) ?? BOOKING_SERVICES[0];

  const availableDays = useMemo(() => {
    const slots = finalAvailabilityData?.slots ?? [];
    const grouped = new Map<string, { key: string; label: string; date: Date; slots: typeof slots }>();

    slots.forEach(slot => {
      const date = new Date(slot.startTime);
      const dayKey = getDayKey(date);
      const existing = grouped.get(dayKey);
      if (existing) {
        existing.slots.push(slot);
      } else {
        grouped.set(dayKey, {
          key: dayKey,
          label: formatDayLabel(date),
          date,
          slots: [slot],
        });
      }
    });

    return Array.from(grouped.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [finalAvailabilityData?.slots]);

  useEffect(() => {
    if (!availableDays.length) {
      setSelectedDateKey(null);
      setSelectedSlot(null);
      return;
    }

    if (!selectedDateKey || !availableDays.some(day => day.key === selectedDateKey)) {
      setSelectedDateKey(availableDays[0].key);
      setSelectedSlot(null);
    }
  }, [availableDays, selectedDateKey]);

  const selectedDay = availableDays.find(day => day.key === selectedDateKey) ?? availableDays[0];
  const daySlots = selectedDay?.slots ?? [];

  useEffect(() => {
    if (selectedSlot && !daySlots.some(slot => slot.id === selectedSlot)) {
      setSelectedSlot(null);
    }
  }, [daySlots, selectedSlot]);

  const goToDay = (direction: -1 | 1) => {
    if (!availableDays.length) return;

    const currentIndex = availableDays.findIndex(day => day.key === selectedDateKey);
    const nextIndex = currentIndex === -1
      ? 0
      : Math.max(0, Math.min(availableDays.length - 1, currentIndex + direction));
    setSelectedDateKey(availableDays[nextIndex].key);
    setSelectedSlot(null);
  };

  const createBookingMutation = trpc.bookings.createBooking.useMutation({
    onSuccess: data => {
      console.log("[Booking] Booking created successfully:", data);
      toast.success("Redirecionando para o pagamento...");

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error("URL de checkout não recebida. Tente novamente.");
        setIsSubmitting(false);
      }
    },
    onError: error => {
      console.error("[Booking] Error creating booking:", error);
      toast.error(
        error.message || "Falha ao criar agendamento. Tente novamente."
      );
      setIsSubmitting(false);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSlot || !finalAvailabilityData) {
      toast.error("Selecione um horário");
      return;
    }

    if (
      !formData.clientName ||
      !formData.clientEmail ||
      !formData.clientPhone
    ) {
      toast.error("Preencha todos os campos");
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedSlotData = finalAvailabilityData.slots.find(
        s => s.id === selectedSlot
      );
      if (!selectedSlotData) {
        toast.error("Horário selecionado não encontrado");
        setIsSubmitting(false);
        return;
      }

      await createBookingMutation.mutateAsync({
        practitionerId,
        clientName: formData.clientName,
        clientEmail: formData.clientEmail,
        clientPhone: formData.clientPhone,
        bookingTime: selectedSlotData.startTime.toISOString(),
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        servicePrice: selectedService.price,
        serviceDurationMinutes: selectedService.durationMinutes,
      });
    } catch (error) {
      console.error("[Booking] Booking error:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen hero-barber flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-gradient shadow-orange-glow">
            <Loader2 className="animate-spin w-7 h-7 text-black" />
          </div>
          <p className="text-foreground font-medium">Carregando horários...</p>
          <p className="text-sm text-muted-foreground mt-2">
            Buscando disponibilidade do barbeiro
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    const isInvalidUUIDError =
      error.message?.includes("Invalid UUID") ||
      error.message?.includes("invalid_format") ||
      (error as any)?.data?.zodError?.issues?.some(
        (issue: any) =>
          issue.code === "invalid_format" && issue.format === "uuid"
      );

    return (
      <div className="min-h-screen hero-barber flex items-center justify-center px-4">
        <Card className="card-barber p-6 max-w-md w-full">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-primary mb-2">
              Erro ao carregar horários
            </h2>
            {isInvalidUUIDError ? (
              <>
                <p className="text-muted-foreground mb-2">
                  O ID do barbeiro é inválido. O sistema usa UUIDs.
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Volte à página inicial e escolha um barbeiro da lista.
                </p>
                <Button
                  onClick={() => navigate("/")}
                  className="w-full mb-2 btn-barber border-0"
                >
                  Voltar ao início
                </Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground mb-4">{error.message}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  ID: {practitionerId}
                </p>
                <Button
                  onClick={() => window.location.reload()}
                  className="w-full btn-barber border-0"
                >
                  Tentar novamente
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (!finalAvailabilityData) {
    return (
      <div className="min-h-screen hero-barber flex items-center justify-center px-4">
        <Card className="card-barber p-6">
          <p className="text-primary">Carregando disponibilidade...</p>
          <p className="text-sm text-muted-foreground mt-2">
            ID: {practitionerId}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-barber py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Brand bar */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-gradient">
              <Scissors className="h-4 w-4 text-black" strokeWidth={2.5} />
            </div>
            <span className="font-semibold text-foreground">Barberia</span>
          </div>
        </div>

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2">
            Agendamento
          </p>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Corte com{" "}
            <span className="text-orange-gradient">
              {finalAvailabilityData.practitioner.name}
            </span>
          </h1>
          <p className="text-muted-foreground">
            Escolha o serviço e confirme o horário antes de agendar.
          </p>
        </div>

        {/* Available Slots */}
        <Card className="card-barber p-6 mb-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Escolha o dia
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => goToDay(-1)}
                className="rounded-full border border-border/60 px-2.5 py-1 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary"
              >
                ←
              </button>
              <span className="text-sm font-medium text-foreground">
                {selectedDay ? selectedDay.label : "--"}
              </span>
              <button
                type="button"
                onClick={() => goToDay(1)}
                className="rounded-full border border-border/60 px-2.5 py-1 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary"
              >
                →
              </button>
            </div>
          </div>

          {availableDays.length === 0 ? (
            <p className="text-muted-foreground">
              Nenhum horário disponível nos próximos 14 dias
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {availableDays.map(day => {
                  const isActive = day.key === selectedDateKey;
                  return (
                    <button
                      key={day.key}
                      type="button"
                      onClick={() => {
                        setSelectedDateKey(day.key);
                        setSelectedSlot(null);
                      }}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-all ${
                        isActive
                          ? "border-transparent bg-orange-gradient text-black shadow-orange-glow"
                          : "border-border/60 bg-black/20 text-foreground hover:border-primary/50"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {daySlots.length === 0 ? (
                  <p className="col-span-full text-sm text-muted-foreground">
                    Nenhum horário disponível para este dia.
                  </p>
                ) : (
                  daySlots.map(slot => (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => handleSlotSelect(slot.id)}
                      className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-1 ${
                        selectedSlot === slot.id
                          ? "border-transparent bg-orange-gradient text-black shadow-orange-glow"
                          : "border-border/60 bg-black/20 hover:border-primary/50 text-foreground"
                      }`}
                    >
                      <Clock
                        className={`w-4 h-4 ${
                          selectedSlot === slot.id ? "text-black" : "text-primary"
                        }`}
                      />
                      <span className="text-sm font-medium">
                        {slot.startTime.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span
                        className={`text-xs ${
                          selectedSlot === slot.id
                            ? "text-black/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {slot.startTime.toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </Card>

        <Card className="card-barber p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            Serviços disponíveis
          </h2>
          <div className="grid gap-3">
            {BOOKING_SERVICES.map(service => {
              const isSelected = selectedServiceId === service.id;
              return (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => setSelectedServiceId(service.id)}
                  className={`rounded-lg border p-4 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-orange-glow"
                      : "border-border/60 bg-black/20 hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{service.name}</p>
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">{formatBRL(service.price)}</p>
                      <p className="text-xs text-muted-foreground">{service.durationMinutes} min</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Booking Form */}
        <Card className="card-barber p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            Seus dados
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="clientName">Nome completo</Label>
              <Input
                id="clientName"
                name="clientName"
                type="text"
                placeholder="João Silva"
                value={formData.clientName}
                onChange={handleFormChange}
                required
                className="bg-black/30 border-border/60 focus-visible:ring-primary"
              />
            </div>

            <div>
              <Label htmlFor="clientEmail">E-mail</Label>
              <Input
                id="clientEmail"
                name="clientEmail"
                type="email"
                placeholder="joao@email.com"
                value={formData.clientEmail}
                onChange={handleFormChange}
                required
                className="bg-black/30 border-border/60 focus-visible:ring-primary"
              />
            </div>

            <div>
              <Label htmlFor="clientPhone">Telefone</Label>
              <Input
                id="clientPhone"
                name="clientPhone"
                type="tel"
                placeholder="+55 (81) 90000-0000"
                value={formData.clientPhone}
                onChange={handleFormChange}
                required
                className="bg-black/30 border-border/60 focus-visible:ring-primary"
              />
            </div>

            <Button
              type="submit"
              disabled={
                !selectedSlot ||
                isSubmitting ||
                createBookingMutation.isPending
              }
              className="w-full btn-barber border-0"
              size="lg"
            >
              {isSubmitting || createBookingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  {createBookingMutation.isPending
                    ? "Criando agendamento..."
                    : "Processando..."}
                </>
              ) : (
                <>
                  <Scissors className="w-4 h-4" />
                  Agendar — {formatBRL(selectedService.price)}
                </>
              )}
            </Button>

            {createBookingMutation.isError && (
              <p className="text-sm text-destructive mt-2">
                {createBookingMutation.error?.message || "Ocorreu um erro"}
              </p>
            )}
          </form>
        </Card>
      </div>
    </div>
  );
}
