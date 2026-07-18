import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle, Home, Loader2, AlertCircle, Scissors } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function BookingSuccess() {
  const [location, navigate] = useLocation();
  const [isVerifying, setIsVerifying] = useState(true);

  const params = new URLSearchParams(location.split("?")[1]);
  const sessionId = params.get("session_id");
  const bookingId = params.get("bookingId");

  const { data: bookingBySession, isLoading: isLoadingBySession } =
    trpc.bookings.getBookingBySessionId.useQuery(
      { sessionId: sessionId || "" },
      {
        enabled: !!sessionId,
        retry: 2,
        retryDelay: 1000,
      }
    );

  const { data: bookingById, isLoading: isLoadingById } =
    trpc.bookings.getBooking.useQuery(
      { bookingId: bookingId || "" },
      {
        enabled: !!bookingId && !sessionId,
        retry: false,
      }
    );

  const bookingData = bookingBySession || bookingById;
  const isLoading = isLoadingBySession || isLoadingById;

  useEffect(() => {
    if (sessionId) {
      console.log("[BookingSuccess] Session ID from Stripe:", sessionId);
      setIsVerifying(false);
    } else if (bookingId) {
      setIsVerifying(isLoading);
    } else {
      setIsVerifying(false);
    }
  }, [sessionId, bookingId, isLoading]);

  return (
    <div className="min-h-screen hero-barber flex items-center justify-center py-8 px-4">
      <Card className="card-barber max-w-md w-full p-8 text-center shadow-orange-glow">
        {isVerifying ? (
          <>
            <div className="flex justify-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-gradient shadow-orange-glow">
                <Loader2 className="w-8 h-8 text-black animate-spin" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Verificando pagamento...
            </h1>
            <p className="text-muted-foreground">
              Aguarde enquanto confirmamos o pagamento.
            </p>
          </>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-gradient shadow-orange-glow">
                <Scissors className="h-6 w-6 text-black" strokeWidth={2.5} />
              </div>
            </div>

            <div className="flex justify-center mb-6">
              <CheckCircle className="w-14 h-14 text-primary" />
            </div>

            <h1 className="text-3xl font-bold text-foreground mb-2">
              Agendamento confirmado!
            </h1>
            <p className="text-muted-foreground mb-6">
              Seu horário na Barberia foi reservado e o pagamento processado com
              sucesso.
            </p>

            <div className="bg-black/30 border border-border/50 p-4 rounded-lg mb-6 text-left">
              <div className="space-y-3">
                {sessionId && (
                  <div>
                    <p className="text-sm text-muted-foreground">Sessão Stripe</p>
                    <p className="font-mono text-xs font-semibold text-foreground break-all">
                      {sessionId}
                    </p>
                  </div>
                )}
                {bookingId && (
                  <div>
                    <p className="text-sm text-muted-foreground">ID do agendamento</p>
                    <p className="font-mono font-semibold text-foreground">
                      {bookingId}
                    </p>
                  </div>
                )}
                {bookingData && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Status</p>
                      <p className="font-semibold text-primary">
                        {bookingData.status || "Confirmado"}
                      </p>
                    </div>
                    {bookingData.clientName && (
                      <div>
                        <p className="text-sm text-muted-foreground">Cliente</p>
                        <p className="font-semibold text-foreground">
                          {bookingData.clientName}
                        </p>
                      </div>
                    )}
                  </>
                )}
                {!sessionId && !bookingId && (
                  <div className="flex items-center gap-2 text-primary">
                    <AlertCircle className="w-4 h-4" />
                    <p className="text-sm">
                      Nenhuma informação de agendamento disponível
                    </p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-8">
              {sessionId
                ? "Pagamento confirmado. Em breve você receberá um e-mail com os detalhes."
                : "Um e-mail de confirmação foi enviado com os detalhes do seu horário."}
            </p>

            <div className="space-y-3">
              <Button
                onClick={() => navigate("/")}
                className="w-full btn-barber border-0"
                size="lg"
              >
                <Home className="mr-2 w-4 h-4" />
                Voltar ao início
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
